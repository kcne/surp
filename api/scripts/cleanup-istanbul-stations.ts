import { PrismaClient } from '@prisma/client';

/**
 * Cleanup: merge duplicate Istanbul stations.
 *
 * Problem: OUTBOUND line "Novi Sad → Istanbul Balbus" uses station
 * "Istanbul Balbus" (cmmuoi9ax...) as arrival, but RETURN line
 * "Istanbul Balbus → Novi Sad" uses a different station
 * "Istanbul - Agencija" (cmnf0knat...) as departure.
 *
 * Fix: point everything at the canonical "Istanbul Balbus" station
 * and deactivate the orphaned "Istanbul - Agencija" station.
 */

const prisma = new PrismaClient();

const OLD_STATION_ID = 'cmnf0knat000poe2xw388ooc6'; // Istanbul - Agencija
const NEW_STATION_ID = 'cmmuoi9ax001upo2x6qijcprg'; // Istanbul Balbus
const TENANT_ID = 'cmmtxi5i70002p82xldkdi3cj';       // balbus-rs

async function main() {
  console.log('=== Istanbul station cleanup ===\n');

  // 1. Verify both stations exist
  const [oldStation, newStation] = await Promise.all([
    prisma.station.findUnique({ where: { id: OLD_STATION_ID } }),
    prisma.station.findUnique({ where: { id: NEW_STATION_ID } }),
  ]);

  if (!oldStation) {
    console.log(`Old station ${OLD_STATION_ID} not found — already cleaned up?`);
    return;
  }
  if (!newStation) {
    throw new Error(`Target station ${NEW_STATION_ID} not found!`);
  }

  console.log(`Old station: "${oldStation.name}" (${OLD_STATION_ID})`);
  console.log(`New station: "${newStation.name}" (${NEW_STATION_ID})\n`);

  // 2. Find all references to the old station
  const [
    linesAsDeparture,
    linesAsArrival,
    lineStops,
    stationTimes,
    reservationsAsDeparture,
    reservationsAsArrival,
  ] = await Promise.all([
    prisma.line.findMany({ where: { departureStationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
    prisma.line.findMany({ where: { arrivalStationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
    prisma.lineStop.findMany({ where: { stationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
    prisma.rideDayScheduleStationTime.findMany({ where: { stationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
    prisma.reservation.findMany({ where: { departureStationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
    prisma.reservation.findMany({ where: { arrivalStationId: OLD_STATION_ID, tenantId: TENANT_ID } }),
  ]);

  console.log('References found:');
  console.log(`  Lines (departure): ${linesAsDeparture.length} — ${linesAsDeparture.map(l => l.name).join(', ') || 'none'}`);
  console.log(`  Lines (arrival):   ${linesAsArrival.length} — ${linesAsArrival.map(l => l.name).join(', ') || 'none'}`);
  console.log(`  Line stops:        ${lineStops.length}`);
  console.log(`  Schedule times:    ${stationTimes.length}`);
  console.log(`  Reservations (dep): ${reservationsAsDeparture.length}`);
  console.log(`  Reservations (arr): ${reservationsAsArrival.length}`);
  console.log();

  // 3. Check for unique constraint conflicts on LineStop
  for (const stop of lineStops) {
    const conflict = await prisma.lineStop.findFirst({
      where: {
        lineId: stop.lineId,
        stationId: NEW_STATION_ID,
      },
    });
    if (conflict) {
      console.log(`⚠ LineStop conflict: line ${stop.lineId} already has a stop for the new station. Will delete old stop ${stop.id} instead of updating.`);
    }
  }

  // 4. Apply changes in a transaction
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN — no changes applied. Remove --dry-run to execute.\n');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 4a. Lines — departure station
    if (linesAsDeparture.length > 0) {
      const result = await tx.line.updateMany({
        where: { departureStationId: OLD_STATION_ID, tenantId: TENANT_ID },
        data: { departureStationId: NEW_STATION_ID },
      });
      console.log(`✓ Updated ${result.count} line(s) departure station`);
    }

    // 4b. Lines — arrival station
    if (linesAsArrival.length > 0) {
      const result = await tx.line.updateMany({
        where: { arrivalStationId: OLD_STATION_ID, tenantId: TENANT_ID },
        data: { arrivalStationId: NEW_STATION_ID },
      });
      console.log(`✓ Updated ${result.count} line(s) arrival station`);
    }

    // 4c. Line stops — handle unique constraint conflicts
    for (const stop of lineStops) {
      const conflict = await tx.lineStop.findFirst({
        where: { lineId: stop.lineId, stationId: NEW_STATION_ID },
      });

      if (conflict) {
        await tx.lineStop.delete({ where: { id: stop.id } });
        console.log(`✓ Deleted conflicting line stop ${stop.id} (line ${stop.lineId})`);
      } else {
        await tx.lineStop.update({
          where: { id: stop.id },
          data: { stationId: NEW_STATION_ID },
        });
        console.log(`✓ Updated line stop ${stop.id} → new station`);
      }
    }

    // 4d. Ride day schedule station times — handle unique constraint
    for (const time of stationTimes) {
      const conflict = await tx.rideDayScheduleStationTime.findFirst({
        where: {
          rideDayScheduleId: time.rideDayScheduleId,
          stationId: NEW_STATION_ID,
        },
      });

      if (conflict) {
        await tx.rideDayScheduleStationTime.delete({ where: { id: time.id } });
        console.log(`✓ Deleted conflicting schedule time ${time.id}`);
      } else {
        await tx.rideDayScheduleStationTime.update({
          where: { id: time.id },
          data: { stationId: NEW_STATION_ID },
        });
        console.log(`✓ Updated schedule time ${time.id} → new station`);
      }
    }

    // 4e. Reservations — departure
    if (reservationsAsDeparture.length > 0) {
      const result = await tx.reservation.updateMany({
        where: { departureStationId: OLD_STATION_ID, tenantId: TENANT_ID },
        data: { departureStationId: NEW_STATION_ID },
      });
      console.log(`✓ Updated ${result.count} reservation(s) departure station`);
    }

    // 4f. Reservations — arrival
    if (reservationsAsArrival.length > 0) {
      const result = await tx.reservation.updateMany({
        where: { arrivalStationId: OLD_STATION_ID, tenantId: TENANT_ID },
        data: { arrivalStationId: NEW_STATION_ID },
      });
      console.log(`✓ Updated ${result.count} reservation(s) arrival station`);
    }

    // 4g. Deactivate old station
    await tx.station.update({
      where: { id: OLD_STATION_ID },
      data: { isActive: false },
    });
    console.log(`✓ Deactivated old station "${oldStation.name}"`);
  });

  console.log('\n✅ Cleanup complete!');
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
