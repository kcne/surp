/**
 * Repairs ride day schedules that drifted out of sync with their line route.
 *
 * A day schedule must mirror its line route exactly. Before the fix in
 * `LinesService.update`, changing a line's stops left existing schedules
 * behind: instances kept materializing from the stale first and last station
 * times, but the ride could no longer be updated, because an update
 * revalidates the stored schedule against the current route.
 *
 * This applies the same reconciliation the service now performs, to rows that
 * were already broken. Stations that survive keep their times, matched by
 * station id; stations new to the route arrive with no time set.
 *
 * Dry run (default):  ts-node --transpile-only scripts/realign-ride-day-schedules.ts
 * Apply:              APPLY=1 ACTOR_USER_ID=<user id> ts-node --transpile-only scripts/realign-ride-day-schedules.ts
 * Scope to a tenant:  TENANT_SLUG=balbus-rs ...
 *
 * ACTOR_USER_ID is required to apply: these rows are audited like any other
 * write, and the shared helper refuses to create them without an actor.
 */
import { PrismaClient } from '@prisma/client';
import {
  buildAlignedStationTimes,
  describeScheduleDrift,
  isScheduleAlignedToRoute,
  realignDayScheduleTx,
  routeStationIdsOf,
} from '../src/rides/ride-schedule-alignment';

const prisma = new PrismaClient();

const apply = process.env.APPLY === '1';
const tenantSlug = process.env.TENANT_SLUG?.trim();
const actorId = process.env.ACTOR_USER_ID?.trim();

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so the rewritten rows carry an author.');
}

async function main() {
  const tenant = tenantSlug
    ? await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } })
    : null;

  if (tenantSlug && !tenant) {
    throw new Error(`Tenant "${tenantSlug}" not found.`);
  }

  const lines = await prisma.line.findMany({
    where: tenant ? { tenantId: tenant.id } : {},
    select: {
      id: true,
      name: true,
      tenantId: true,
      departureStationId: true,
      arrivalStationId: true,
      intermediateStops: {
        select: { stationId: true, orderIndex: true },
        orderBy: { orderIndex: 'asc' },
      },
      rides: {
        select: {
          id: true,
          name: true,
          daySchedules: {
            select: {
              id: true,
              dayOfWeek: true,
              stationTimes: {
                select: { stationId: true, orderIndex: true, time: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  let scanned = 0;
  let drifted = 0;
  let estimatedTotal = 0;
  let reorderedTotal = 0;

  for (const line of lines) {
    const routeStationIds = routeStationIdsOf(line);

    for (const ride of line.rides) {
      for (const daySchedule of ride.daySchedules) {
        scanned += 1;

        if (daySchedule.stationTimes.length === 0) {
          continue;
        }

        if (isScheduleAlignedToRoute(daySchedule.stationTimes, routeStationIds)) {
          continue;
        }

        drifted += 1;

        const { addedStationIds, removedStationIds, reorderedStationIds } = describeScheduleDrift(
          daySchedule.stationTimes,
          routeStationIds
        );
        const aligned = buildAlignedStationTimes(routeStationIds, daySchedule.stationTimes);
        const estimated = aligned.filter((stationTime) => stationTime.isEstimated);
        estimatedTotal += estimated.length;

        if (reorderedStationIds.length > 0) {
          reorderedTotal += 1;
        }

        console.log(
          `${apply ? 'FIX ' : 'DRIFT'} line="${line.name}" ride="${ride.name}" day=${daySchedule.dayOfWeek} ` +
            `schedule=${daySchedule.stationTimes.length} route=${routeStationIds.length} ` +
            `added=${addedStationIds.length} removed=${removedStationIds.length} ` +
            `reordered=${reorderedStationIds.length} ` +
            `estimated=${estimated.map((stationTime) => stationTime.time).join(',') || 'none'}`
        );

        if (!apply) {
          continue;
        }

        // Same helper the service and the maintenance endpoint use, so the
        // offline repair cannot drift from the online one.
        await prisma.$transaction((tx) =>
          realignDayScheduleTx(tx, {
            tenantId: line.tenantId,
            rideDayScheduleId: daySchedule.id,
            stationTimes: daySchedule.stationTimes,
            routeStationIds,
            actorId: actorId as string,
          })
        );
      }
    }
  }

  console.log(
    `\n${apply ? 'Repaired' : 'Would repair'} ${drifted} of ${scanned} day schedules` +
      (apply ? '.' : '. Re-run with APPLY=1 to write.')
  );

  if (estimatedTotal > 0) {
    console.log(
      `${estimatedTotal} station times ${apply ? 'were' : 'would be'} estimated (15 min per stop, ` +
        'or spread evenly between known times). Review them in Raspored.'
    );
  }

  if (reorderedTotal > 0) {
    console.log(
      `${reorderedTotal} schedules have stops the route moved past one another. Their times are ` +
        'carried over unchanged, so they may now read out of sequence. Review them in Raspored.'
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
