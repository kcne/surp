import { LINKABLE_SOURCES, departureLinkKey } from '../../departures/departure-link';
import { withUpdateAudit } from '../../prisma/audit-write.helper';
import { formatDateOnly, utcDateOf } from '../../rides/ride-instance-materialization';
import {
  ORPHAN_AMBIGUOUS_TARGET_ADVICE,
  ORPHAN_NO_FREE_SEAT_ADVICE,
  ORPHAN_REASON_ADVICE,
  ORPHAN_REASON_LABELS,
  classifyLinkedReservation,
  classifyReservation,
  findOffRouteStationIds,
  resolveSeatNumber,
  type OrphanReason
} from './orphaned-reservations';
import { loadReservationWindow } from './reservation-window';
import { CheckResult, InvariantContext, ProspectiveInvariant, RepairResult } from '../invariant.types';
import { loadStationNames } from './tenant-lookups';
import { serbianPlural } from '../serbian-plural';
import { inScheduleEdit } from '../in-schedule-edit';

/**
 * A reservation is only ever reached through a ride instance, and instances are
 * derived on read rather than stored. The join key is
 * `rideId : travelDate : rideDepartureTime`, so a reservation whose stored
 * departure time no longer matches any instance on its own travel date is
 * invisible everywhere in the app while still sitting in the database, holding
 * its seat against a capacity nobody can see.
 *
 * Editing a route is enough to cause it: the instance departure time is the
 * first station's time, so putting a new station at the head of a line renames
 * every instance on it and strands every reservation booked before the change.
 *
 * Since #27 PR 3b a reservation on a stored departure is judged by that
 * departure instead: the sync keeps its time copies in step, so it is
 * reachable while the bus runs, and listed, never repaired, once the bus is
 * cancelled or dropped from the timetable. The time repair is left for a row
 * with no departure, which it links.
 */

export interface OrphanedReservationItem {
  reservationId: string;
  passengerName: string;
  passengerPhone: string;
  travelDate: string;
  rideName: string;
  lineName: string;
  departureStationName: string;
  arrivalStationName: string;
  currentDepartureTime: string;
  targetDepartureTime: string | null;
  targetArrivalTime: string | null;
  seatNumber: number;
  targetSeatNumber: number | null;
  reason: OrphanReason;
  reasonLabel: string;
  reasonAdvice: string;
  canRepair: boolean;
  offRouteStationNames: string[];
}

export interface OrphanReport {
  windowStartDate: string;
  windowEndDate: string;
  scannedReservationCount: number;
  orphanedCount: number;
  repairableCount: number;
  seatChangeCount: number;
  items: OrphanedReservationItem[];
}

export interface OrphanRepairOutcome {
  repairedCount: number;
  seatChangedCount: number;
  skippedCount: number;
  items: OrphanedReservationItem[];
}

export async function buildOrphanReport(
  ctx: InvariantContext,
  subjectIds?: ReadonlySet<string>
): Promise<OrphanReport> {
  const scan = await scanForOrphans(ctx, subjectIds);

  return {
    windowStartDate: scan.windowStartDate,
    windowEndDate: scan.windowEndDate,
    scannedReservationCount: scan.scannedReservationCount,
    orphanedCount: scan.items.length,
    repairableCount: scan.items.filter((item) => item.canRepair).length,
    seatChangeCount: scan.items.filter(
      (item) => item.canRepair && item.targetSeatNumber !== item.seatNumber
    ).length,
    items: scan.items
  };
}

/**
 * Moves every orphan a single instance can claim onto that instance.
 *
 * The scan is re-run here rather than trusting a report the caller may have
 * loaded minutes ago, so seat assignments are decided against the current
 * state of the bus.
 */
export async function repairOrphanedReservations(
  ctx: InvariantContext,
  subjectIds?: ReadonlySet<string>
): Promise<OrphanRepairOutcome> {
  const scan = await scanForOrphans(ctx, subjectIds);

  let repairedCount = 0;
  let seatChangedCount = 0;
  let skippedCount = 0;

  for (const item of scan.items) {
    if (subjectIds && !subjectIds.has(item.reservationId)) {
      continue;
    }

    if (!item.canRepair || !item.targetDepartureTime || item.targetSeatNumber === null) {
      skippedCount += 1;
      continue;
    }

    // The new time can belong to another bus on the same date, an extra, so
    // the link is the bus the scan resolved for it rather than kept (#27 PR
    // 1b). It is empty only where no departure is stored for that date yet.
    const departureId = scan.targetDepartureIds.get(item.reservationId) ?? null;

    // A prospective write passes its transaction here, so a later failure
    // rolls back every selected update along with the proposed write.
    await ctx.prisma.reservation.update({
      where: { id: item.reservationId },
      data: withUpdateAudit(
        {
          departureId,
          rideDepartureTime: item.targetDepartureTime,
          rideArrivalTime: item.targetArrivalTime ?? undefined,
          seatNumber: item.targetSeatNumber
        },
        ctx.actorId
      )
    });

    repairedCount += 1;

    if (item.targetSeatNumber !== item.seatNumber) {
      seatChangedCount += 1;
    }
  }

  return {
    repairedCount,
    seatChangedCount,
    skippedCount,
    items: subjectIds
      ? scan.items.filter((item) => subjectIds.has(item.reservationId))
      : scan.items
  };
}

/**
 * Walks every active reservation travelling inside the window and asks which
 * ride instance, if any, can still reach it. A prospective repair can limit
 * which orphans compete for target seats while visible reservations still
 * retain their seats.
 */
export async function scanForOrphans(ctx: InvariantContext, subjectIds?: ReadonlySet<string>): Promise<{
  windowStartDate: string;
  windowEndDate: string;
  scannedReservationCount: number;
  items: OrphanedReservationItem[];
  /** The bus a repairable orphan is linked to, null where none is stored yet. */
  targetDepartureIds: ReadonlyMap<string, string | null>;
}> {
  const window = await loadReservationWindow(ctx);

  if (window.reservations.length === 0) {
    return {
      windowStartDate: window.windowStartDate,
      windowEndDate: window.windowEndDate,
      scannedReservationCount: 0,
      items: [],
      targetDepartureIds: new Map()
    };
  }

  const stationNameById = await loadStationNames(ctx);

  // Seats already spoken for on each instance, so a repair never lands a
  // passenger on top of one who is currently visible.
  const occupiedSeats = new Map<string, Set<number>>();

  const claimSeat = (rideId: string, travelDate: string, departureTime: string, seat: number) => {
    const key = `${rideId}:${travelDate}:${departureTime}`;
    const seats = occupiedSeats.get(key) ?? new Set<number>();
    seats.add(seat);
    occupiedSeats.set(key, seats);
  };

  type OrphanCandidate = {
    reservation: (typeof window.reservations)[number];
    travelDate: string;
    ride: NonNullable<ReturnType<typeof window.rideOf>>;
    reason: OrphanReason;
    targetDepartureTime: string | null;
    targetArrivalTime: string | null;
  };

  const orphanCandidates: OrphanCandidate[] = [];

  for (const reservation of window.reservations) {
    const travelDate = formatDateOnly(reservation.travelDate)!;
    const ride = window.rideOf(reservation);

    if (!ride) {
      continue;
    }

    const departure = window.departureOf(reservation);
    const day = window.dayOf(ride, travelDate);
    const classification = departure
      ? classifyLinkedReservation(departure, day)
      : classifyReservation({ ...reservation, travelDate }, day);

    if (!classification) {
      // Reachable today, so its seat is genuinely taken.
      claimSeat(
        reservation.rideId,
        travelDate,
        departure?.departureTime ?? reservation.rideDepartureTime,
        reservation.seatNumber
      );
      continue;
    }

    orphanCandidates.push({
      reservation,
      travelDate,
      ride,
      reason: classification.reason,
      targetDepartureTime: classification.targetDepartureTime,
      targetArrivalTime: classification.targetArrivalTime
    });
  }

  // An orphan moves onto the bus its new time names, and an extra has its own
  // capacity (#27, PR 3d), so seats are checked against that bus.
  const targetOf = await loadRepairTargets(ctx, orphanCandidates);
  const capacityOf = (ride: { id: string; capacity: number }, travelDate: string, time: string) =>
    targetOf(ride, travelDate, time).capacity;

  // Seats are resolved only after every visible reservation has claimed its
  // own, so an orphan never wins a seat that a visible passenger holds.
  //
  // Orphans are then resolved in two passes rather than one. A single pass
  // lets an orphan whose seat was taken grab the lowest free seat, which is
  // often a seat another orphan could still have kept — moving one passenger
  // then cascades into moving several. Letting everyone who can keep their
  // seat claim it first cut the moves on the tenant this was built for from
  // 66 to 39, and every avoided move is a passenger nobody has to call.
  const seatByReservationId = new Map<string, number | null>();
  const needsAnotherSeat: OrphanCandidate[] = [];

  for (const candidate of orphanCandidates) {
    if (subjectIds && !subjectIds.has(candidate.reservation.id)) {
      continue;
    }

    const { reservation, ride, travelDate, targetDepartureTime } = candidate;

    // Two buses at the new time are not guessed between, so no seat is
    // placed on either.
    if (!targetDepartureTime || targetOf(ride, travelDate, targetDepartureTime).ambiguous) {
      seatByReservationId.set(reservation.id, null);
      continue;
    }

    const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime}`;
    const taken = occupiedSeats.get(key) ?? new Set<number>();

    if (
      reservation.seatNumber <= capacityOf(ride, travelDate, targetDepartureTime) &&
      !taken.has(reservation.seatNumber)
    ) {
      seatByReservationId.set(reservation.id, reservation.seatNumber);
      claimSeat(reservation.rideId, travelDate, targetDepartureTime, reservation.seatNumber);
      continue;
    }

    needsAnotherSeat.push(candidate);
  }

  for (const candidate of needsAnotherSeat) {
    const { reservation, ride, travelDate, targetDepartureTime } = candidate;
    const key = `${reservation.rideId}:${travelDate}:${targetDepartureTime!}`;
    const seat = resolveSeatNumber(
      reservation.seatNumber,
      occupiedSeats.get(key) ?? new Set<number>(),
      capacityOf(ride, travelDate, targetDepartureTime!)
    );

    seatByReservationId.set(reservation.id, seat);

    if (seat !== null) {
      claimSeat(reservation.rideId, travelDate, targetDepartureTime!, seat);
    }
  }

  const items: OrphanedReservationItem[] = orphanCandidates.map((candidate) => {
    const { reservation, ride, travelDate, targetDepartureTime } = candidate;
    const route = window.routeOf(reservation, ride);
    const routeStationIds = new Set<string>([
      route.departureStationId,
      route.arrivalStationId,
      ...route.intermediateStops.map((stop) => stop.stationId)
    ]);

    const targetSeatNumber = seatByReservationId.get(reservation.id) ?? null;
    const stationName = (stationId: string) => stationNameById.get(stationId) ?? stationId;

    // A known departure with no free seat, or two buses at the new time, are
    // the cases where the reason's own sentence would promise a repair that
    // declines to run.
    const ambiguousTarget =
      targetDepartureTime !== null && targetOf(ride, travelDate, targetDepartureTime).ambiguous;
    const noFreeSeat = targetDepartureTime !== null && targetSeatNumber === null;

    return {
      reservationId: reservation.id,
      passengerName: `${reservation.passenger.firstName} ${reservation.passenger.lastName}`,
      passengerPhone: reservation.passenger.phone,
      travelDate,
      rideName: ride.name,
      lineName: ride.line.name,
      departureStationName: stationName(reservation.departureStationId),
      arrivalStationName: stationName(reservation.arrivalStationId),
      currentDepartureTime: reservation.rideDepartureTime,
      targetDepartureTime,
      targetArrivalTime: candidate.targetArrivalTime,
      seatNumber: reservation.seatNumber,
      targetSeatNumber,
      reason: candidate.reason,
      reasonLabel: ORPHAN_REASON_LABELS[candidate.reason],
      reasonAdvice: ambiguousTarget
        ? ORPHAN_AMBIGUOUS_TARGET_ADVICE
        : noFreeSeat
          ? ORPHAN_NO_FREE_SEAT_ADVICE
          : ORPHAN_REASON_ADVICE[candidate.reason],
      canRepair: targetDepartureTime !== null && targetSeatNumber !== null,
      offRouteStationNames: findOffRouteStationIds(
        { ...reservation, travelDate },
        routeStationIds
      ).map(stationName)
    };
  });

  const targetDepartureIds = new Map<string, string | null>();

  for (const candidate of orphanCandidates) {
    if (candidate.targetDepartureTime) {
      targetDepartureIds.set(
        candidate.reservation.id,
        targetOf(candidate.ride, candidate.travelDate, candidate.targetDepartureTime).departureId
      );
    }
  }

  return {
    windowStartDate: window.windowStartDate,
    windowEndDate: window.windowEndDate,
    scannedReservationCount: window.reservations.length,
    items,
    targetDepartureIds
  };
}

export const reservationReachable: ProspectiveInvariant = {
  key: 'reservation.reachable',
  title: 'Rezervacija se vidi na svom polasku',
  description:
    'Rezervacija se vezuje za polazak preko vremena polaska, a to vreme se racuna iz prve stanice na ruti. Kada se ruta ili raspored promene, polazak dobija novo vreme i rezervacija nestaje sa svih spiskova, iako je i dalje u bazi i i dalje drzi sediste.',
  manualAdvice:
    'Popravka vraca samo rezervacije za koje tog dana postoji tacno jedan polazak. Za ostale otvorite taj datum u voznjama: ako polaska nema, napravite ga ili pozovite putnika; ako ih ima vise, prebacite rezervaciju rucno na onaj koji je putnik kupio; ako je autobus pun, povecajte kapacitet ili ponudite drugi termin.',
  severity: 'critical',

  breakingChangeMessage: (count) =>
    `Ova izmena cini ${serbianPlural(count, 'rezervaciju nevidljivom', 'rezervacije nevidljivim', 'rezervacija nevidljivim')}.`,

  // Names the seat as well as the time, because the repair can move it: the
  // old seat may be taken on the departure the reservation is moving onto, and
  // an agency that reads only "premesta na novo vreme" would not know to tell
  // the passenger they are sitting somewhere else.
  repairMessage: (count) =>
    `Premesta ${serbianPlural(count, 'rezervaciju', 'rezervacije', 'rezervacija')} na novo vreme polaska i slobodno sediste.`,

  async check(ctx: InvariantContext): Promise<CheckResult> {
    const report = await buildOrphanReport(ctx);

    return toCheckResult(report);
  },

  async assessRepair(ctx: InvariantContext, subjectIds: ReadonlySet<string>): Promise<CheckResult> {
    return toCheckResult(await buildOrphanReport(ctx, subjectIds));
  },

  async repair(ctx: InvariantContext, subjectIds?: ReadonlySet<string>): Promise<RepairResult> {
    const { repairedCount, skippedCount } = await inScheduleEdit(
      ctx,
      (locked) => repairOrphanedReservations(locked, subjectIds),
      { changesTimetable: false }
    );

    return { repairedCount, skippedCount };
  }
};

function toCheckResult(report: OrphanReport): CheckResult {
  return {
    scannedCount: report.scannedReservationCount,
    violations: report.items.map((item) => ({
      subjectType: 'reservation' as const,
      subjectId: item.reservationId,
      summary: `${item.passengerName}, ${item.travelDate}, polazak ${item.currentDepartureTime}: ${item.reasonLabel.toLowerCase()}.`,
      detail: { ...item },
      canRepair: item.canRepair
    }))
  };
}

interface RepairTarget {
  /** Null when no departure is stored for that date yet. */
  departureId: string | null;
  capacity: number;
  /** More than one stored bus at the time, and not exactly one of them runs. */
  ambiguous: boolean;
}

/**
 * The bus each orphan would move onto, and its capacity.
 *
 * - None stored at the new time: the ride's capacity, and no link, as for a
 *   date the nightly job has yet to store.
 * - One stored: that one.
 * - Several (#27, PR 4c lets two buses of a ride share a time): the one that
 *   runs, when a cancelled or dropped bus shares its time. Otherwise the
 *   repair declines rather than leave the passenger unlinked, which would
 *   keep the seat off the count booking checks (`departureId` only). The
 *   smallest capacity is reported, so a seat is never placed past any of them.
 */
async function loadRepairTargets(
  ctx: InvariantContext,
  candidates: ReadonlyArray<{
    reservation: { rideId: string };
    travelDate: string;
    targetDepartureTime: string | null;
  }>
): Promise<
  (ride: { id: string; capacity: number }, travelDate: string, departureTime: string) => RepairTarget
> {
  const targeted = candidates.filter((candidate) => candidate.targetDepartureTime !== null);
  const rideIds = [...new Set(targeted.map((candidate) => candidate.reservation.rideId))];
  const dates = [...new Set(targeted.map((candidate) => candidate.travelDate))];
  const departures =
    targeted.length === 0
      ? []
      : await ctx.prisma.departure.findMany({
          where: {
            tenantId: ctx.tenantId,
            rideId: { in: rideIds },
            serviceDate: { in: dates.map(utcDateOf) },
            source: { in: [...LINKABLE_SOURCES] }
          },
          select: {
            id: true,
            rideId: true,
            serviceDate: true,
            departureTime: true,
            capacity: true,
            cancelledAt: true,
            timetableDroppedAt: true
          }
        });
  const departuresByKey = new Map<string, typeof departures>();

  for (const departure of departures) {
    const key = departureLinkKey(departure.rideId, departure.serviceDate, departure.departureTime);

    departuresByKey.set(key, [...(departuresByKey.get(key) ?? []), departure]);
  }

  return (ride, travelDate, departureTime) => {
    const stored = departuresByKey.get(`${ride.id}:${travelDate}:${departureTime}`) ?? [];

    if (stored.length === 0) {
      return { departureId: null, capacity: ride.capacity, ambiguous: false };
    }

    const running = stored.filter(
      (departure) => departure.cancelledAt === null && departure.timetableDroppedAt === null
    );
    const target = stored.length === 1 ? stored[0] : running.length === 1 ? running[0] : null;

    return target
      ? { departureId: target.id, capacity: target.capacity, ambiguous: false }
      : {
          departureId: null,
          capacity: Math.min(...stored.map((departure) => departure.capacity)),
          ambiguous: true
        };
  };
}
