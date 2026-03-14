import { ReservationStatus, RideStatus, UserRole } from '@prisma/client';
import { AuditEntity } from './dto/reporting-audit.query.dto';
import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  const prismaMock = {
    ride: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    line: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    station: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    passenger: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    reservation: {
      count: jest.fn(),
      findMany: jest.fn()
    },
    user: {
      findMany: jest.fn()
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  let service: ReportingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportingService(prismaMock as never);

    prismaMock.ride.count.mockResolvedValue(3);
    prismaMock.line.count.mockResolvedValue(2);
    prismaMock.station.count.mockResolvedValue(5);
    prismaMock.passenger.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40);

    prismaMock.reservation.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.station.findMany.mockResolvedValue([]);
    prismaMock.line.findMany.mockResolvedValue([]);
    prismaMock.passenger.findMany.mockResolvedValue([]);
    prismaMock.ride.findMany.mockResolvedValue([]);
  });

  it('builds dashboard summary and top lines from reservation analytics rows', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-1',
        ride: {
          capacity: 20,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      },
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.CANCELLED,
        passengerId: 'passenger-2',
        ride: {
          capacity: 20,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      },
      {
        travelDate: new Date('2026-03-11T00:00:00.000Z'),
        rideId: 'ride-2',
        rideDepartureTime: '14:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-1',
        ride: {
          capacity: 10,
          line: {
            id: 'line-2',
            name: 'South - East'
          }
        }
      }
    ]);

    const result = await service.getDashboard(auth, {
      fromDate: '2026-03-10',
      toDate: '2026-03-11'
    });

    expect(result.summary.totalReservations).toBe(3);
    expect(result.summary.activeReservations).toBe(2);
    expect(result.summary.cancelledReservations).toBe(1);
    expect(result.summary.uniqueBookedPassengers).toBe(2);
    expect(result.summary.utilizationPercent).toBeCloseTo(6.67, 2);
    expect(result.topLines[0].lineId).toBe('line-1');
    expect(result.dailyReservations).toHaveLength(2);
  });

  it('returns occupancy points grouped by date and line', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-1',
        ride: {
          capacity: 20,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      },
      {
        travelDate: new Date('2026-03-10T00:00:00.000Z'),
        rideId: 'ride-1',
        rideDepartureTime: '09:00',
        status: ReservationStatus.ACTIVE,
        passengerId: 'passenger-2',
        ride: {
          capacity: 20,
          line: {
            id: 'line-1',
            name: 'Central - North'
          }
        }
      }
    ]);

    const result = await service.getOccupancy(auth, {
      fromDate: '2026-03-10',
      toDate: '2026-03-10',
      lineId: 'line-1'
    });

    expect(result.points).toHaveLength(1);
    expect(result.points[0].activeReservations).toBe(2);
    expect(result.points[0].totalCapacity).toBe(20);
    expect(result.summary.overallUtilizationPercent).toBe(10);
  });

  it('filters audit trail by entity and actor', async () => {
    prismaMock.reservation.findMany.mockResolvedValue([
      {
        id: 'reservation-1',
        createdById: 'admin-1',
        updatedById: 'manager-1',
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-11T00:00:00.000Z')
      },
      {
        id: 'reservation-2',
        createdById: 'admin-1',
        updatedById: 'admin-1',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
        updatedAt: new Date('2026-03-12T00:00:00.000Z')
      }
    ]);

    const result = await service.getAudit(auth, {
      entity: AuditEntity.RESERVATIONS,
      actorUserId: 'admin-1',
      fromDate: '2026-03-01',
      toDate: '2026-03-31',
      page: 1,
      pageSize: 20
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].entity).toBe(AuditEntity.RESERVATIONS);
    expect(result.items[0].entityId).toBe('reservation-2');
  });

  it('scopes dashboard ride count by tenant and active status', async () => {
    await service.getDashboard(auth, {
      fromDate: '2026-03-01',
      toDate: '2026-03-31'
    });

    expect(prismaMock.ride.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        status: RideStatus.ACTIVE
      }
    });
  });
});
