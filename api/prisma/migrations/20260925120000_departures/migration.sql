-- Stores departures: one bus on one service date (#27, PR 1a).
--
-- Shadow phase. Nothing reads these tables yet: the generator in
-- src/departures keeps them in step with the timetable, and the read-only
-- check departure.matchesTimetable reports any difference. Bookings start
-- filling Reservation.departureId in PR 1b.
--
-- Additive only: two new tables and one nullable column. No existing row is
-- read or rewritten.

CREATE TYPE "DepartureSource" AS ENUM ('SCHEDULE', 'EXTRA', 'LEGACY');

ALTER TABLE "Reservation" ADD COLUMN "departureId" TEXT;

CREATE TABLE "Departure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "source" "DepartureSource" NOT NULL,
    "lineId" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "timetableDroppedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "rideExceptionId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Departure_pkey" PRIMARY KEY ("id"),
    -- A cancellation is one fact: when and by whom, or neither.
    CONSTRAINT "Departure_cancellation_complete"
      CHECK (("cancelledAt" IS NULL) = ("cancelledById" IS NULL)),
    CONSTRAINT "Departure_capacity_positive" CHECK ("capacity" > 0),
    CONSTRAINT "Departure_departureTime_format"
      CHECK ("departureTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "Departure_arrivalTime_format"
      CHECK ("arrivalTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE "DepartureStop" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departureId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "time" TEXT,
    "isBoarding" BOOLEAN NOT NULL,
    "isDropoff" BOOLEAN NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DepartureStop_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DepartureStop_time_format"
      CHECK ("time" IS NULL OR "time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX "Departure_tenantId_serviceDate_idx" ON "Departure"("tenantId", "serviceDate");
CREATE INDEX "Departure_rideId_serviceDate_idx" ON "Departure"("rideId", "serviceDate");
CREATE INDEX "Departure_lineId_idx" ON "Departure"("lineId");
CREATE INDEX "Departure_rideExceptionId_idx" ON "Departure"("rideExceptionId");
CREATE INDEX "Departure_updatedById_idx" ON "Departure"("updatedById");

-- The target of the reservation foreign key below. It carries rideId and
-- serviceDate so a linked reservation cannot disagree with its departure.
CREATE UNIQUE INDEX "Departure_id_rideId_serviceDate_tenantId_key"
  ON "Departure"("id", "rideId", "serviceDate", "tenantId");

-- A ride has at most one schedule per weekday, so at most one timetable
-- departure per date. Extra buses have their own identity and are not
-- limited. Prisma cannot express partial indexes, which is why this
-- migration is hand-written.
CREATE UNIQUE INDEX "Departure_schedule_key"
  ON "Departure"("rideId", "serviceDate")
  WHERE "source" = 'SCHEDULE';

-- The backfill keys past departures the timetable no longer produces by the
-- time the reservations were sold for.
CREATE UNIQUE INDEX "Departure_legacy_key"
  ON "Departure"("rideId", "serviceDate", "departureTime")
  WHERE "source" = 'LEGACY';

CREATE INDEX "DepartureStop_tenantId_idx" ON "DepartureStop"("tenantId");
CREATE INDEX "DepartureStop_stationId_idx" ON "DepartureStop"("stationId");
CREATE UNIQUE INDEX "DepartureStop_departureId_orderIndex_key" ON "DepartureStop"("departureId", "orderIndex");
CREATE UNIQUE INDEX "DepartureStop_departureId_stationId_key" ON "DepartureStop"("departureId", "stationId");

CREATE INDEX "Reservation_departureId_idx" ON "Reservation"("departureId");

-- MATCH SIMPLE: a reservation with no departureId is not checked, which is
-- every reservation until PR 1b.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_departureId_rideId_travelDate_tenantId_fkey"
  FOREIGN KEY ("departureId", "rideId", "travelDate", "tenantId")
  REFERENCES "Departure"("id", "rideId", "serviceDate", "tenantId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Departure" ADD CONSTRAINT "Departure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Departure" ADD CONSTRAINT "Departure_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Departure" ADD CONSTRAINT "Departure_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Deleting the exception leaves the extra behind with no source, for the
-- sync to remove (or drop, once something references it) in the same
-- transaction.
ALTER TABLE "Departure" ADD CONSTRAINT "Departure_rideExceptionId_fkey" FOREIGN KEY ("rideExceptionId") REFERENCES "RideException"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DepartureStop" ADD CONSTRAINT "DepartureStop_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DepartureStop" ADD CONSTRAINT "DepartureStop_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "Departure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartureStop" ADD CONSTRAINT "DepartureStop_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same audit as every other domain table (#109).
CREATE TRIGGER "Departure_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "Departure"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();

CREATE TRIGGER "DepartureStop_domain_audit"
  AFTER INSERT OR UPDATE OR DELETE ON "DepartureStop"
  FOR EACH ROW EXECUTE FUNCTION "record_domain_audit"();
