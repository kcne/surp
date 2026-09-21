-- Records which return leg belongs to which outbound leg.
--
-- groupId is the driver-facing manifest label for a party on one departure and
-- roundTripId marks a whole booking; neither can carry the round-trip
-- invariant, because a partially cancelled multi-seat booking is an ordinary
-- agency action and looks identical to a half-cancelled return ticket under
-- both. A leg pair cannot: two rows, one passenger, opposite directions.
--
-- Additive only: one nullable column plus constraints. No existing row is read
-- or rewritten, and the column stays NULL until the backfill runs.

ALTER TABLE "Reservation" ADD COLUMN "returnOfReservationId" TEXT;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_returnOfReservationId_fkey"
  FOREIGN KEY ("returnOfReservationId") REFERENCES "Reservation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Reservation_returnOfReservationId_idx"
  ON "Reservation"("returnOfReservationId");

-- One *live* return leg per outbound leg. Cancelling a return and booking a
-- different one is routine, so uniqueness holds only among ACTIVE rows; a
-- plain UNIQUE would let the cancelled leg keep the link and reject the new
-- booking. Prisma cannot express a partial index, which is why this migration
-- is hand-written and the model declares a one-to-many self-relation.
CREATE UNIQUE INDEX "Reservation_active_return_leg_key"
  ON "Reservation"("returnOfReservationId")
  WHERE "status" = 'ACTIVE';
