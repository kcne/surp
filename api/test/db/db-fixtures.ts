import {
  LineDirection,
  LineDirectionMode,
  PassengerType,
  RideStatus,
  RideType,
  StationCategory,
  UserRole
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../../src/auth/auth.types';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Tenants for the real-database specs. Each test seeds a tenant of its own and
 * removes it afterwards, so specs can share one migrated database.
 */

export interface Seeded {
  auth: AccessTokenPayload;
  lineId: string;
  scheduleId: string;
  rideId: string;
  passengerId: string;
  travelDate: string;
  otherTravelDate: string;
  stations: { first: string; last: string };
}

export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A tenant with one weekly 09:00 ride of 48 seats and one passenger. */
export async function seedTenant(prisma: PrismaService): Promise<Seeded> {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const suffix = tenantId.slice(0, 8);
  const travel = new Date();
  travel.setUTCHours(0, 0, 0, 0);
  travel.setUTCDate(travel.getUTCDate() + 7);
  const otherTravel = new Date(travel);
  otherTravel.setUTCDate(otherTravel.getUTCDate() + 7);
  const recurringStartDate = new Date(travel);
  recurringStartDate.setUTCDate(recurringStartDate.getUTCDate() - 30);

  await prisma.tenant.create({
    data: { id: tenantId, slug: `db-${suffix}`, name: `DB ${suffix}` }
  });
  await prisma.user.create({
    data: {
      id: actorId,
      tenantId,
      username: `db-admin-${suffix}`,
      email: `db-admin-${suffix}@example.test`,
      passwordHash: 'not-used',
      role: UserRole.ADMIN,
      isActive: true
    }
  });

  const [first, last] = [randomUUID(), randomUUID()];
  await prisma.station.createMany({
    data: [
      { id: first, name: `First ${suffix}` },
      { id: last, name: `Last ${suffix}` }
    ].map((station) => ({
      ...station,
      tenantId,
      address: 'Test Street',
      category: StationCategory.BUS_STOP,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }))
  });

  const lineId = randomUUID();
  await prisma.line.create({
    data: {
      id: lineId,
      tenantId,
      name: `Line ${suffix}`,
      departureStationId: first,
      arrivalStationId: last,
      directionMode: LineDirectionMode.SINGLE,
      direction: LineDirection.OUTBOUND,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });

  const rideId = randomUUID();
  await prisma.ride.create({
    data: {
      id: rideId,
      tenantId,
      lineId,
      name: `Ride ${suffix}`,
      capacity: 48,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate,
      createdById: actorId,
      updatedById: actorId
    }
  });

  const scheduleId = randomUUID();
  await prisma.rideDaySchedule.create({
    data: {
      id: scheduleId,
      tenantId,
      rideId,
      dayOfWeek: travel.getUTCDay(),
      createdById: actorId,
      updatedById: actorId
    }
  });
  await prisma.rideDayScheduleStationTime.createMany({
    data: [
      { stationId: first, orderIndex: 0, time: '09:00' },
      { stationId: last, orderIndex: 1, time: '11:00' }
    ].map((entry) => ({
      ...entry,
      tenantId,
      rideDayScheduleId: scheduleId,
      createdById: actorId,
      updatedById: actorId
    }))
  });

  const passengerId = randomUUID();
  await prisma.passenger.create({
    data: {
      id: passengerId,
      tenantId,
      firstName: 'Test',
      lastName: 'Passenger',
      phone: `+3816${Math.floor(Math.random() * 1e8)}`,
      passengerType: PassengerType.ADULT,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });

  return {
    auth: { sub: actorId, tenantId, role: UserRole.ADMIN, username: `db-admin-${suffix}` },
    lineId,
    scheduleId,
    rideId,
    passengerId,
    travelDate: dateOnly(travel),
    otherTravelDate: dateOnly(otherTravel),
    stations: { first, last }
  };
}

/**
 * Tables a seeded tenant writes to, children first. The audit triggers record
 * the cleanup's deletes too, so `AuditEvent` goes after every audited table.
 */
const TENANT_TABLES = [
  'Reservation',
  'Passenger',
  'RideDayScheduleStationTime',
  'RideDaySchedule',
  'RideException',
  'Ride',
  'LineStop',
  'Line',
  'AuditEvent',
  'Station',
  'RefreshSession',
  'User'
] as const;

/**
 * Some of these tests deliberately leave a confirmed breakage behind, which the
 * integrity report would find on the next run against the same database.
 */
export async function removeTenant(prisma: PrismaService, tenantId: string): Promise<void> {
  for (const table of TENANT_TABLES) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "tenantId" = $1`, tenantId);
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "Tenant" WHERE "id" = $1`, tenantId);
}
