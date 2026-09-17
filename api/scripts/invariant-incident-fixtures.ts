import {
  LineDirection,
  LineDirectionMode,
  PassengerType,
  Prisma,
  PrismaClient,
  ReservationStatus,
  RideExceptionType,
  RideStatus,
  RideType,
  StationCategory,
  UserRole
} from '@prisma/client';
import { InvariantContext, Violation } from '../src/invariants/invariant.types';
import { INVARIANTS, findInvariant } from '../src/invariants/registry';
import { PrismaService } from '../src/prisma/prisma.service';
import { dayOfWeekOf, formatDateOnly } from '../src/rides/ride-instance-materialization';

interface FixtureState {
  tenantId: string;
  actorId: string;
  lineId: string;
  rideId: string;
  scheduleId: string;
  passengerId: string;
  reservationId: string;
  travelDate: Date;
  stationIds: { first: string; middle: string; last: string; alternate: string };
  stationTimeIds: { first: string; middle: string; last: string };
  lineStopId: string;
}

interface IncidentFixture {
  name: string;
  invariantKey: string;
  mutate(tx: Prisma.TransactionClient, state: FixtureState): Promise<void>;
  matches?(violation: Violation, state: FixtureState): boolean;
}

export interface IncidentFixtureResult {
  name: string;
  invariantKey: string;
}

class FixtureRollback extends Error {
  constructor(readonly result: IncidentFixtureResult) {
    super('rollback invariant incident fixture');
  }
}

const fixtures: IncidentFixture[] = [
  {
    name: 'first schedule station time changes after sale',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      await tx.rideDayScheduleStationTime.update({
        where: { id: state.stationTimeIds.first },
        data: { time: '08:30' }
      });
    },
    matches: reason('DEPARTURE_TIME_MOVED')
  },
  {
    name: 'last schedule station time changes after sale',
    invariantKey: 'reservation.arrivalTimeCurrent',
    mutate: async (tx, state) => {
      await tx.rideDayScheduleStationTime.update({
        where: { id: state.stationTimeIds.last },
        data: { time: '11:30' }
      });
    }
  },
  {
    name: 'scheduled weekday is removed after sale',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      await tx.rideDaySchedule.delete({ where: { id: state.scheduleId } });
    },
    matches: reason('WEEKDAY_NOT_SCHEDULED')
  },
  {
    name: 'recurring range is shortened past a sold date',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      const end = new Date(state.travelDate);
      end.setUTCDate(end.getUTCDate() - 1);
      await tx.ride.update({
        where: { id: state.rideId },
        data: { recurringEndDate: end }
      });
    },
    matches: reason('DATE_OUTSIDE_RANGE')
  },
  {
    name: 'ride is deactivated after sale',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      await tx.ride.update({ where: { id: state.rideId }, data: { status: RideStatus.INACTIVE } });
    },
    matches: reason('RIDE_NOT_ACTIVE')
  },
  {
    name: 'SKIP exception is added on a sold date',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      await tx.rideException.create({
        data: {
          id: fixtureId('exception-skip'),
          tenantId: state.tenantId,
          rideId: state.rideId,
          exceptionDate: state.travelDate,
          type: RideExceptionType.SKIP,
          createdById: state.actorId,
          updatedById: state.actorId
        }
      });
    },
    matches: reason('SKIPPED_BY_EXCEPTION')
  },
  {
    name: 'ADDITIONAL exception is deleted after sale',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      const exception = await tx.rideException.create({
        data: {
          id: fixtureId('exception-additional'),
          tenantId: state.tenantId,
          rideId: state.rideId,
          exceptionDate: state.travelDate,
          type: RideExceptionType.ADDITIONAL,
          departureTime: '12:00',
          arrivalTime: '14:00',
          createdById: state.actorId,
          updatedById: state.actorId
        }
      });
      await tx.reservation.update({
        where: { id: state.reservationId },
        data: { rideDepartureTime: '12:00', rideArrivalTime: '14:00' }
      });
      await tx.rideException.delete({ where: { id: exception.id } });
    },
    matches: reason('DEPARTURE_TIME_MOVED')
  },
  {
    name: 'capacity is lowered below an occupied seat',
    invariantKey: 'reservation.seatWithinCapacity',
    mutate: async (tx, state) => {
      await tx.ride.update({ where: { id: state.rideId }, data: { capacity: 3 } });
    }
  },
  {
    name: 'ride line is replaced after sale',
    invariantKey: 'reservation.stationsOnRoute',
    mutate: async (tx, state) => {
      const replacementLineId = fixtureId('line-replacement');
      await tx.line.create({
        data: {
          id: replacementLineId,
          tenantId: state.tenantId,
          name: 'Replacement route',
          departureStationId: state.stationIds.middle,
          arrivalStationId: state.stationIds.alternate,
          directionMode: LineDirectionMode.SINGLE,
          direction: LineDirection.OUTBOUND,
          isActive: true,
          createdById: state.actorId,
          updatedById: state.actorId
        }
      });
      await tx.ride.update({ where: { id: state.rideId }, data: { lineId: replacementLineId } });
    }
  },
  {
    name: 'route is reordered after sale',
    invariantKey: 'reservation.reachable',
    mutate: async (tx, state) => {
      await tx.lineStop.update({
        where: { id: state.lineStopId },
        data: { stationId: state.stationIds.first }
      });
      await tx.line.update({
        where: { id: state.lineId },
        data: { departureStationId: state.stationIds.middle }
      });
      await tx.rideDayScheduleStationTime.update({
        where: { id: state.stationTimeIds.first },
        data: { orderIndex: 99 }
      });
      await tx.rideDayScheduleStationTime.update({
        where: { id: state.stationTimeIds.middle },
        data: { orderIndex: 0 }
      });
      await tx.rideDayScheduleStationTime.update({
        where: { id: state.stationTimeIds.first },
        data: { orderIndex: 1 }
      });
    },
    matches: reason('DEPARTURE_TIME_MOVED')
  },
  {
    name: 'boarding is disabled at a sold departure stop',
    invariantKey: 'reservation.segmentValid',
    mutate: async (tx, state) => {
      await tx.lineStop.update({
        where: { id: state.lineStopId },
        data: { isBoarding: false }
      });
    },
    matches: (violation) => violation.detail.departureNotBoarding === true
  },
  {
    name: 'route station is deactivated',
    invariantKey: 'route.stationsActive',
    mutate: async (tx, state) => {
      await tx.station.update({
        where: { id: state.stationIds.middle },
        data: { isActive: false }
      });
    },
    matches: (_violation, state) => _violation.subjectId === state.lineId
  },
  {
    name: 'passenger is deactivated with a future reservation',
    invariantKey: 'reservation.passengerActive',
    mutate: async (tx, state) => {
      await tx.passenger.update({ where: { id: state.passengerId }, data: { isActive: false } });
    }
  },
  {
    name: 'line is deactivated while its ride remains active',
    invariantKey: 'ride.lineActive',
    mutate: async (tx, state) => {
      await tx.line.update({ where: { id: state.lineId }, data: { isActive: false } });
    },
    matches: (_violation, state) => _violation.subjectId === state.rideId
  }
];

export async function runIncidentFixtures(prisma: PrismaClient): Promise<IncidentFixtureResult[]> {
  const results: IncidentFixtureResult[] = [];

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];

    try {
      await prisma.$transaction(async (tx) => {
        const state = await seedValidFixture(tx, index);
        if (!findInvariant(fixture.invariantKey)) {
          throw new Error(
            `Fixture ${fixture.name} names unknown invariant ${fixture.invariantKey}`
          );
        }

        const before = await runRegistry(contextFor(tx, state));
        const baselineFindings = before.flatMap((entry) =>
          entry.result.violations.map((violation) => `${entry.invariantKey}:${violation.subjectId}`)
        );
        if (baselineFindings.length > 0) {
          throw new Error(
            `Fixture ${fixture.name} is invalid before its incident mutation: ${baselineFindings.join(', ')}`
          );
        }

        await fixture.mutate(tx, state);
        const reports = await runRegistry(contextFor(tx, state));
        const report = reports.find((entry) => entry.invariantKey === fixture.invariantKey)!;
        const detected = report.result.violations.some((violation) =>
          fixture.matches
            ? fixture.matches(violation, state)
            : violation.subjectId === state.reservationId
        );

        if (!detected) {
          throw new Error(`Fixture ${fixture.name} was not detected by ${fixture.invariantKey}`);
        }

        throw new FixtureRollback({ name: fixture.name, invariantKey: fixture.invariantKey });
      });
    } catch (error: unknown) {
      if (error instanceof FixtureRollback) {
        results.push(error.result);
        continue;
      }
      throw error;
    }
  }

  return results;
}

function contextFor(tx: Prisma.TransactionClient, state: FixtureState): InvariantContext {
  return {
    tenantId: state.tenantId,
    actorId: state.actorId,
    prisma: tx as unknown as PrismaService,
    windowDays: 30
  };
}

async function runRegistry(ctx: InvariantContext) {
  const reports: Array<{
    invariantKey: string;
    result: Awaited<ReturnType<(typeof INVARIANTS)[number]['check']>>;
  }> = [];

  for (const invariant of INVARIANTS) {
    reports.push({ invariantKey: invariant.key, result: await invariant.check(ctx) });
  }

  return reports;
}

function reason(expected: string): (violation: Violation) => boolean {
  return (violation) => violation.detail.reason === expected;
}

function fixtureId(part: string, index?: number): string {
  return `invariant-ci-${index ?? 'shared'}-${part}`;
}

async function seedValidFixture(
  tx: Prisma.TransactionClient,
  index: number
): Promise<FixtureState> {
  const tenantId = fixtureId('tenant', index);
  const actorId = fixtureId('actor', index);
  const lineId = fixtureId('line', index);
  const rideId = fixtureId('ride', index);
  const scheduleId = fixtureId('schedule', index);
  const passengerId = fixtureId('passenger', index);
  const reservationId = fixtureId('reservation', index);
  const stationIds = {
    first: fixtureId('station-first', index),
    middle: fixtureId('station-middle', index),
    last: fixtureId('station-last', index),
    alternate: fixtureId('station-alternate', index)
  };
  const stationTimeIds = {
    first: fixtureId('time-first', index),
    middle: fixtureId('time-middle', index),
    last: fixtureId('time-last', index)
  };
  const lineStopId = fixtureId('line-stop', index);
  const travelDate = new Date();
  travelDate.setUTCHours(0, 0, 0, 0);
  travelDate.setUTCDate(travelDate.getUTCDate() + 7);
  const recurringStartDate = new Date(travelDate);
  recurringStartDate.setUTCDate(recurringStartDate.getUTCDate() - 30);

  await tx.tenant.create({
    data: {
      id: tenantId,
      slug: fixtureId('tenant-slug', index),
      name: `Invariant fixture ${index}`
    }
  });
  await tx.user.create({
    data: {
      id: actorId,
      tenantId,
      username: fixtureId('admin', index),
      email: `${fixtureId('admin', index)}@example.test`,
      passwordHash: 'not-used-by-invariant-fixtures',
      role: UserRole.ADMIN,
      isActive: true
    }
  });
  await tx.station.createMany({
    data: Object.entries(stationIds).map(([name, id]) => ({
      id,
      tenantId,
      name: `Fixture ${name}`,
      address: `${index} Fixture Street`,
      category: StationCategory.BUS_STOP,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }))
  });
  await tx.line.create({
    data: {
      id: lineId,
      tenantId,
      name: 'Fixture first - last',
      departureStationId: stationIds.first,
      arrivalStationId: stationIds.last,
      directionMode: LineDirectionMode.SINGLE,
      direction: LineDirection.OUTBOUND,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });
  await tx.lineStop.create({
    data: {
      id: lineStopId,
      tenantId,
      lineId,
      stationId: stationIds.middle,
      orderIndex: 0,
      isBoarding: true,
      isDropoff: true,
      createdById: actorId,
      updatedById: actorId
    }
  });
  await tx.ride.create({
    data: {
      id: rideId,
      tenantId,
      lineId,
      name: 'Fixture ride',
      capacity: 4,
      type: RideType.RECURRING,
      status: RideStatus.ACTIVE,
      recurringStartDate,
      createdById: actorId,
      updatedById: actorId
    }
  });
  await tx.rideDaySchedule.create({
    data: {
      id: scheduleId,
      tenantId,
      rideId,
      dayOfWeek: dayOfWeekOf(formatDateOnly(travelDate)!),
      createdById: actorId,
      updatedById: actorId
    }
  });
  await tx.rideDayScheduleStationTime.createMany({
    data: [
      { id: stationTimeIds.first, stationId: stationIds.first, orderIndex: 0, time: '09:00' },
      { id: stationTimeIds.middle, stationId: stationIds.middle, orderIndex: 1, time: '10:00' },
      { id: stationTimeIds.last, stationId: stationIds.last, orderIndex: 2, time: '11:00' }
    ].map((entry) => ({
      ...entry,
      tenantId,
      rideDayScheduleId: scheduleId,
      createdById: actorId,
      updatedById: actorId
    }))
  });
  await tx.passenger.create({
    data: {
      id: passengerId,
      tenantId,
      firstName: 'Fixture',
      lastName: 'Passenger',
      phone: `+38160000${String(index).padStart(3, '0')}`,
      passengerType: PassengerType.ADULT,
      isActive: true,
      createdById: actorId,
      updatedById: actorId
    }
  });
  await tx.reservation.create({
    data: {
      id: reservationId,
      tenantId,
      rideId,
      passengerId,
      travelDate,
      rideDepartureTime: '09:00',
      rideArrivalTime: '11:00',
      seatNumber: 4,
      status: ReservationStatus.ACTIVE,
      departureStationId: stationIds.middle,
      arrivalStationId: stationIds.last,
      groupId: fixtureId('group', index),
      createdById: actorId,
      updatedById: actorId
    }
  });

  return {
    tenantId,
    actorId,
    lineId,
    rideId,
    scheduleId,
    passengerId,
    reservationId,
    travelDate,
    stationIds,
    stationTimeIds,
    lineStopId
  };
}
