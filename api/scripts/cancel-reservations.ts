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
 * Dry run (default): TENANT_ID=<tenant id> RESERVATION_IDS=id1,id2 pnpm reservations:cancel
 * Apply:             APPLY=1 ACTOR_USER_ID=<user id> TENANT_ID=<tenant id> RESERVATION_IDS=id1,id2 pnpm reservations:cancel
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
/**
 * One run, one agency. Ids are opaque cuids, so a list pasted from two
 * spreadsheets would otherwise cancel rows for a tenant nobody named.
 */
const tenantId = process.env.TENANT_ID?.trim();
/** A linked reservation can be either the outbound or the return leg. */
const allowLinked = process.env.ALLOW_LINKED === '1';

const ids = (process.env.RESERVATION_IDS ?? '')
  .split(/[\s,]+/)
  .map((id) => id.trim())
  .filter(Boolean);

if (ids.length === 0) {
  throw new Error('RESERVATION_IDS is required: a comma or whitespace separated list of ids.');
}

if (!tenantId) {
  throw new Error('TENANT_ID is required: every read and write here is scoped to one tenant.');
}

if (apply && !actorId) {
  throw new Error('ACTOR_USER_ID is required when APPLY=1, so cancelled rows carry an author.');
}

async function main() {
  const found = await prisma.reservation.findMany({
    where: { id: { in: ids }, tenantId },
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
  // An id that exists under another tenant is a different mistake from a typo,
  // and saying so is the difference between the operator fixing their TENANT_ID
  // and their hunting for a row that is sitting right there.
  const otherTenant = missing.length > 0
    ? await prisma.reservation.findMany({
        where: { id: { in: missing } },
        select: { id: true, tenantId: true }
      })
    : [];

  for (const id of missing) {
    const elsewhere = otherTenant.find((row) => row.id === id);
    console.log(
      elsewhere
        ? `OTHER TENANT  ${id} belongs to ${elsewhere.tenantId}, not ${tenantId}.`
        : `NOT FOUND  ${id}`
    );
  }

  if (apply && otherTenant.length > 0) {
    throw new Error(
      `${otherTenant.length} of the requested ids belong to another tenant. ` +
        'Refusing to apply: fix TENANT_ID or the id list and re-run the dry run.'
    );
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

  // Nothing above held a lock, so a return-leg backfill could have paired one
  // of these rows between the read and here. The linked-leg refusal is only
  // worth anything if it is re-decided under the locks, and stated once more in
  // the update itself so the row cannot slip through between the two.
  const linkedGuard = allowLinked
    ? {}
    : {
        returnLegs: { none: { status: ReservationStatus.ACTIVE } },
        OR: [
          { returnOfReservationId: null },
          { returnOf: { status: { not: ReservationStatus.ACTIVE } } }
        ]
      };

  const cancelledCount = await prisma.$transaction(async (tx) => {
    for (const lockKey of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    }

    const fresh = await tx.reservation.findMany({
      where: { id: { in: cancellable.map((row) => row.id) }, tenantId },
      select: {
        id: true,
        returnOfReservationId: true,
        returnOf: { select: { status: true } },
        _count: { select: { returnLegs: { where: { status: ReservationStatus.ACTIVE } } } }
      }
    });

    const stillCancellable = fresh.filter((row) => {
      const linked =
        row._count.returnLegs > 0 || row.returnOf?.status === ReservationStatus.ACTIVE;

      if (linked && !allowLinked) {
        console.log(
          `  SKIP ${row.id} — it gained a live linked leg after the dry run was read. ` +
            'Re-run the dry run before deciding on it.'
        );

        return false;
      }

      return true;
    });

    const result = await tx.reservation.updateMany({
      where: {
        id: { in: stillCancellable.map((row) => row.id) },
        tenantId,
        status: ReservationStatus.ACTIVE,
        ...linkedGuard
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
