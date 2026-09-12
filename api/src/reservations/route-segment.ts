/**
 * The part of a route one reservation actually occupies a seat for.
 *
 * Stations are numbered along the line, so a segment is the half-open interval
 * between the station the passenger boards at and the one they get off at.
 * Two reservations can hold the same seat on the same bus as long as their
 * intervals do not overlap — the seat is legitimately resold once the first
 * passenger is off.
 *
 * This lives outside the service because the same arithmetic decides three
 * things: whether a booking is accepted, whether a seat is double-sold, and
 * how full a departure is. A second copy of it would be a copy that disagrees,
 * and disagreeing about which reservations share a bus is how 40 seats were
 * resold in #14.
 */

export type RouteSegment = {
  departureOrder: number;
  arrivalOrder: number;
};

/**
 * Whether two passengers are on the bus at the same time.
 *
 * Half-open on purpose: a passenger getting off at station 3 frees the seat for
 * one boarding at station 3, so `[0,3)` and `[3,6)` do not overlap.
 */
export function segmentsOverlap(a: RouteSegment, b: RouteSegment): boolean {
  return Math.max(a.departureOrder, b.departureOrder) < Math.min(a.arrivalOrder, b.arrivalOrder);
}

/**
 * Whether a segment covers the leg between station `order` and `order + 1`.
 *
 * Legs are the smallest unit a seat can be counted on: how full a bus is only
 * has an answer leg by leg, because a bus with 20 seats can carry far more than
 * 20 passengers over a route if none of them travel together.
 */
export function segmentCoversLeg(segment: RouteSegment, order: number): boolean {
  return segment.departureOrder <= order && order < segment.arrivalOrder;
}

/**
 * Numbers the stations of a line from the departure terminus to the arrival
 * terminus, which is the ordering every segment is expressed in.
 *
 * `intermediateStops` must already be sorted by `orderIndex`; the caller owns
 * that because it owns the query.
 */
export function routeStationOrder(line: {
  departureStationId: string;
  arrivalStationId: string;
  intermediateStops: { stationId: string }[];
}): Map<string, number> {
  const stationOrderById = new Map<string, number>();

  stationOrderById.set(line.departureStationId, 0);

  line.intermediateStops.forEach((stop, index) => {
    stationOrderById.set(stop.stationId, index + 1);
  });

  stationOrderById.set(line.arrivalStationId, line.intermediateStops.length + 1);

  return stationOrderById;
}
