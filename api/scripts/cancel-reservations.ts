/**
 * Cancels named reservations, for the rows the admin UI cannot reach.
 *
 * A reservation is only visible through its ride instance, and instances are
 * derived from the current route. A reservation whose departure time no longer
 * matches any instance — after a station is added to the head of a line, say —
 * is invisible in the app while still holding its seat, so there is no screen
 * on which to cancel it. `reservation.reachable` repairs the ones that should
 * be *moved* onto the departure that replaced theirs; this handles the other
 * case, a row left behind by a rebooking that should simply go away.
 *
 * Dry run (default): RESERVATION_IDS=id1,id2 pnpm reservations:cancel
 * Apply:             APPLY=1 ACTOR_USER_ID=<user id> RESERVATION_IDS=id1,id2 pnpm reservations:cancel
 *
 * The dry run prints every row in full and is the point of the script: read it
 * before enabling APPLY. Nothing is deleted — this is the same soft cancel the
 * API performs, so the row keeps its history.
 */
import { PrismaClient, ReservationStatus } from '@prisma/client';
import { withUpdateAudit } from '../src/prisma/audit-write.helper';

const prisma = new PrismaClient();
const apply = process.env.APPLY === '1';
const actorId = process.env.ACTOR_USER_ID?.trim();
/** A linked reservation can be either the outbound or the return leg. */
const allowLinked = process.env.ALLOW_LINKED === '1';

const ids = (process.env.RESERVATION_IDS ?? '')
  .split(/[\s,]+/)
  .map((id) => id.trim())
  .filter(Boolean);

if (ids.length === 0) {
  throw new Error('RESERVATION_IDS is required: a comma or whitespace separated list of ids.');
}

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so cancelled rows carry an author.');
}

async function main() {
  const found = await prisma.reservation.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      tenantId: true,
      rideId: true,
      travelDate: true,
      rideDepartureTime: true,
      seatNumber: true,
      status: true,
      roundTripId: true,
      returnOfReservationId: true,
      returnOf: { select: { status: true } },
      notes: true,
      passenger: { select: { firstName: true, lastName: true, phone: true } },
      departureStation: { select: { name: true } },
      arrivalStation: { select: { name: true } },
      ride: { select: { name: true } },
      _count: { select: { returnLegs: { where: { status: ReservationStatus.ACTIVE } } } }
    }
  });

  const missing = ids.filter((id) => !found.some((row) => row.id === id));
  for (const id of missing) {
    console.log(`NOT FOUND  ${id}`);
  }

  const cancellable: typeof found = [];

  for (const row of found) {
    const who = `${row.passenger.firstName} ${row.passenger.lastName} (${row.passenger.phone})`;
    const journey =
      `${row.departureStation.name} -> ${row.arrivalStation.name}, ` +
      `${row.travelDate.toISOString().slice(0, 10)} ${row.rideDepartureTime}, seat ${row.seatNumber}`;

    console.log(`\n${row.id}`);
    console.log(`  ${who}`);
    console.log(`  ${journey} on ${row.ride.name}`);
    console.log(
      `  status ${row.status}` +
        (row.roundTripId ? `, booking marker ${row.roundTripId}` : '') +
        (row.returnOfReservationId ? `, return leg of ${row.returnOfReservationId}` : '') +
        (row.notes ? `, notes: ${row.notes}` : '')
    );

    if (row.status === ReservationStatus.CANCELLED) {
      console.log('  SKIP — already cancelled.');
      continue;
    }

    if ((row._count.returnLegs > 0 || row.returnOf?.status === ReservationStatus.ACTIVE) && !allowLinked) {
      const linkedLegs = [
        ...(row.returnOf?.status === ReservationStatus.ACTIVE
          ? [`this return leg points at active reservation ${row.returnOfReservationId}`]
          : []),
        ...(row._count.returnLegs > 0
          ? [`${row._count.returnLegs} active return leg(s) point at this reservation`]
          : [])
      ];
      console.log(
        `  SKIP — ${linkedLegs.join(' and ')}. ` +
          'Cancelling it would leave that pair half dead. Re-run with ALLOW_LINKED=1 if that is intended.'
      );
      continue;
    }

    cancellable.push(row);
  }

  console.log(
    `\n${cancellable.length} of ${ids.length} would be cancelled` +
      (missing.length > 0 ? `, ${missing.length} not found` : '') +
      '.'
  );

  if (!apply) {
    console.log('Dry run only. Re-run with APPLY=1 and ACTOR_USER_ID=<user id> to write.');
    return;
  }

  // One transaction, and the instance locks taken up front in sorted order:
  // cancelling races with booking on the same departure, and taking the locks
  // in a fixed order is what stops two of these meeting head on. See #81.
  const lockKeys = [
    ...new Set(
      cancellable.map(
        (row) =>
          `${row.tenantId}:${row.rideId}:${row.travelDate.toISOString().slice(0, 10)}:${row.rideDepartureTime}`
      )
    )
  ].sort();

  const cancelledCount = await prisma.$transaction(async (tx) => {
    for (const lockKey of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    }

    const result = await tx.reservation.updateMany({
      where: {
        id: { in: cancellable.map((row) => row.id) },
        status: ReservationStatus.ACTIVE
      },
      data: withUpdateAudit(
        { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
        actorId as string
      )
    });

    return result.count;
  });

  console.log(`Cancelled ${cancelledCount} reservation(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
