-- Every reservation names its departure (#27, PR 5).
--
-- Bookings link themselves since PR 1b, `departures:backfill` linked the rest
-- in PR 2, and `reservation.departureLinked` has been critical since PR 3b. The
-- column was nullable only until that was true. Making it required also makes
-- the composite foreign key (MATCH SIMPLE) check every row: none of its four
-- columns can be null any more.
--
-- Stops with a count instead of Postgres's bare "contains null values", so a
-- failed deploy says how many rows are in the way. Nothing is written.
DO $$
DECLARE
  unlinked bigint;
BEGIN
  SELECT count(*) INTO unlinked FROM "Reservation" WHERE "departureId" IS NULL;

  IF unlinked > 0 THEN
    RAISE EXCEPTION '% reservation(s) have no departureId. Link them before this migration runs.', unlinked;
  END IF;
END $$;

ALTER TABLE "Reservation" ALTER COLUMN "departureId" SET NOT NULL;
