import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { withUpdateAudit } from '../prisma/audit-write.helper';

/**
 * Links a return leg to the outbound leg it belongs to.
 *
 * `groupId` is the driver-facing manifest label for a party on one departure
 * and `roundTripId` marks a whole booking, so neither can answer "is this
 * passenger's return still standing?" — under both, a partially cancelled
 * multi-seat booking is indistinguishable from a half-cancelled return ticket.
 * A leg pair can: two rows, one passenger, opposite directions, so one side
 * cancelled and the other not is always a real defect.
 *
 * Every rule below is checked here rather than trusted from the client,
 * because a wrong link is worse than a missing one: it sends staff to phone a
 * passenger about a journey that was never sold.
 */

/**
 * How far after an outbound leg a return leg is still plausibly the same
 * journey. Used by the backfill that pairs rows predating this column.
 */
export const LEGACY_RETURN_LOOKUP_DAYS = 90;

/** The partial unique index from 20260921130000_reservation_return_leg. */
const ACTIVE_RETURN_LEG_INDEX = 'Reservation_active_return_leg_key';

const OUTBOUND_SELECT = Prisma.validator<Prisma.ReservationSelect>()({
  id: true,
  tenantId: true,
  passengerId: true,
  departureStationId: true,
  arrivalStationId: true,
  travelDate: true,
  rideDepartureTime: true,
  status: true,
  roundTripId: true
});

export interface ReturnLegCandidate {
  passengerId: string;
  departureStationId: string;
  arrivalStationId: string;
  travelDate: Date;
  rideDepartureTime: string;
}

export interface ReturnLegLink {
  returnOfReservationId: string;
  /** The booking marker, taken from the outbound leg so both carry the same one. */
  roundTripId: string;
}

interface LinkReturnLegInput {
  tenantId: string;
  actorId: string;
  outboundReservationId: string;
  /** Shared by return legs created in the same sale. */
  bookingMarker?: string;
  leg: ReturnLegCandidate;
  /** The reservation being updated, so it cannot become its own return leg. */
  excludeReservationId?: string;
}

function departsBefore(
  leg: Pick<ReturnLegCandidate, 'travelDate' | 'rideDepartureTime'>,
  outbound: Pick<ReturnLegCandidate, 'travelDate' | 'rideDepartureTime'>
): boolean {
  const legDate = leg.travelDate.getTime();
  const outboundDate = outbound.travelDate.getTime();

  if (legDate !== outboundDate) {
    return legDate < outboundDate;
  }

  return leg.rideDepartureTime < outbound.rideDepartureTime;
}

export async function linkReturnLeg(
  tx: Prisma.TransactionClient,
  input: LinkReturnLegInput
): Promise<ReturnLegLink> {
  const { tenantId, actorId, outboundReservationId, leg, excludeReservationId } = input;

  if (excludeReservationId && excludeReservationId === outboundReservationId) {
    throw new BadRequestException('A reservation cannot be its own return leg');
  }

  const outbound = await tx.reservation.findFirst({
    where: { id: outboundReservationId, tenantId },
    select: OUTBOUND_SELECT
  });

  if (!outbound) {
    throw new NotFoundException('The outbound reservation of this return leg was not found');
  }

  if (outbound.status !== ReservationStatus.ACTIVE) {
    throw new BadRequestException('A return leg cannot be attached to a cancelled reservation');
  }

  if (outbound.passengerId !== leg.passengerId) {
    throw new BadRequestException(
      'A return leg must belong to the same passenger as its outbound leg'
    );
  }

  if (
    outbound.departureStationId !== leg.arrivalStationId ||
    outbound.arrivalStationId !== leg.departureStationId
  ) {
    throw new BadRequestException(
      'A return leg must travel between the same two stations in the opposite direction'
    );
  }

  if (departsBefore(leg, outbound)) {
    throw new BadRequestException('A return leg cannot depart before its outbound leg');
  }

  // The partial unique index enforces this too, but a P2002 surfaces as an
  // opaque 500 and says nothing about which reservation is in the way.
  const existingReturnLeg = await tx.reservation.findFirst({
    where: {
      tenantId,
      returnOfReservationId: outbound.id,
      status: ReservationStatus.ACTIVE,
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {})
    },
    select: { id: true }
  });

  if (existingReturnLeg) {
    throw new ConflictException('This reservation already has a return leg');
  }

  // A one-way ticket carries no booking marker, so the first return leg is
  // what turns the outbound into a round trip. Stamping both sides keeps the
  // marker meaning exactly what it says: sold together.
  const roundTripId = outbound.roundTripId ?? input.bookingMarker ?? randomUUID();

  if (!outbound.roundTripId) {
    await tx.reservation.update({
      where: { id: outbound.id },
      data: withUpdateAudit({ roundTripId }, actorId)
    });
  }

  return { returnOfReservationId: outbound.id, roundTripId };
}

/**
 * The check above and the write that follows it are not one atomic step, so
 * two concurrent bookings can both pass it and leave the loser to the partial
 * unique index. Untranslated, that reaches the operator as a 500 with an
 * opaque body; this gives it the same 409 the check produces.
 */
/**
 * True when a write lost the race for an outbound leg's one live return slot.
 * The API turns this into a 409; the backfill records the row as contended and
 * moves on, rather than letting one lost race abort a whole operator run.
 */
export function isActiveReturnLegConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const target = error.meta?.target;

  return typeof target === 'string'
    ? target.includes(ACTIVE_RETURN_LEG_INDEX)
    : Array.isArray(target) && target.includes('returnOfReservationId');
}

export function asReturnLegConflict(error: unknown): unknown {
  return isActiveReturnLegConflict(error)
    ? new ConflictException('This reservation already has a return leg')
    : error;
}
