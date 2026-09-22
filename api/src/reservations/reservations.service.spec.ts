import { BadRequestException, ConflictException } from '@nestjs/common';
import { ReservationStatus, UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';

describe('ReservationsService', () => {
  let reservationStore: Array<{
    id: string;
    tenantId: string;
    rideId: string;
    passengerId: string;
    travelDate: Date;
    rideDepartureTime: string;
    rideArrivalTime: string;
    seatNumber: number;
    status: ReservationStatus;
    departureStationId: string;
    arrivalStationId: string;
  }>;

  let transactionQueue: Promise<void>;

  const prismaMock = {
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    reservation: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    ride: {
      findFirst: jest.fn()
    },
    passenger: {
      findFirst: jest.fn()
    }
  };

  const auth = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'demo-admin'
  };

  const routeRide = {
    id: 'ride-1',
    line: {
      isActive: true,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d',
      intermediateStops: [
        { stationId: 'station-b', orderIndex: 1, isBoarding: true, isDropoff: true },
        { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: true }
      ]
    }
  };

  const baseReservation = {
    id: 'reservation-1',
    tenantId: 'tenant-1',
    rideId: 'ride-1',
    passengerId: 'passenger-1',
    createdById: 'admin-1',
    updatedById: 'admin-1',
    travelDate: new Date('2026-03-30T00:00:00.000Z'),
    rideDepartureTime: '09:00',
    rideArrivalTime: '10:30',
    seatNumber: 12,
    status: ReservationStatus.ACTIVE,
    cancelledAt: null,
    departureStationId: 'station-a',
    arrivalStationId: 'station-c',
    groupId: null,
    roundTripId: null,
    returnOfReservationId: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ride: {
      id: 'ride-1',
      name: 'Morning Ride',
      lineId: 'line-1'
    },
    passenger: {
      id: 'passenger-1',
      firstName: 'Mila',
      lastName: 'Markovic',
      phone: '+381640000111'
    },
    departureStation: {
      id: 'station-a',
      name: 'Central'
    },
    arrivalStation: {
      id: 'station-c',
      name: 'Midway'
    }
  };

  let service: ReservationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    reservationStore = [];
    transactionQueue = Promise.resolve();

    service = new ReservationsService(prismaMock as never);

    prismaMock.$executeRaw.mockResolvedValue(1);

    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        const previous = transactionQueue;
        let release: () => void = () => undefined;
        const snapshot = reservationStore.map((item) => ({ ...item }));
        transactionQueue = new Promise<void>((resolve) => {
          release = resolve;
        });

        await previous;

        try {
          return await (input as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
        } catch (error) {
          reservationStore = snapshot;
          throw error;
        } finally {
          release();
        }
      }

      return Promise.all(input as Promise<unknown>[]);
    });

    prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
    prismaMock.passenger.findFirst.mockResolvedValue({ id: 'passenger-1' });

    prismaMock.reservation.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        return reservationStore
          .filter((item) => {
            if (where.tenantId && item.tenantId !== where.tenantId) {
              return false;
            }

            if (where.rideId && item.rideId !== where.rideId) {
              return false;
            }

            if (where.rideDepartureTime && item.rideDepartureTime !== where.rideDepartureTime) {
              return false;
            }

            if (where.seatNumber !== undefined && item.seatNumber !== where.seatNumber) {
              return false;
            }

            if (where.status && item.status !== where.status) {
              return false;
            }

            if (
              where.travelDate &&
              item.travelDate.toISOString() !== (where.travelDate as Date).toISOString()
            ) {
              return false;
            }

            if (
              where.id &&
              typeof where.id === 'object' &&
              where.id !== null &&
              'not' in where.id
            ) {
              if (item.id === (where.id as { not: string }).not) {
                return false;
              }
            }

            return true;
          })
          .map((item) => ({
            id: item.id,
            seatNumber: item.seatNumber,
            departureStationId: item.departureStationId,
            arrivalStationId: item.arrivalStationId
          }));
      }
    );

    prismaMock.reservation.findFirst.mockResolvedValue({ ...baseReservation });

    prismaMock.reservation.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          ...baseReservation,
          id: `reservation-${reservationStore.length + 1}`,
          passengerId: data.passengerId as string,
          seatNumber: data.seatNumber as number,
          departureStationId: data.departureStationId as string,
          arrivalStationId: data.arrivalStationId as string,
          travelDate: data.travelDate as Date,
          rideDepartureTime: data.rideDepartureTime as string,
          rideArrivalTime: data.rideArrivalTime as string,
          createdById: data.createdById as string,
          updatedById: data.updatedById as string,
          groupId: (data.groupId as string | null | undefined) ?? null,
          roundTripId: (data.roundTripId as string | null | undefined) ?? null,
          returnOfReservationId:
            (data.returnOfReservationId as string | null | undefined) ?? null,
          notes: (data.notes as string | null | undefined) ?? null
        };

        reservationStore.push({
          id: created.id,
          tenantId: created.tenantId,
          rideId: created.rideId,
          passengerId: created.passengerId,
          travelDate: created.travelDate,
          rideDepartureTime: created.rideDepartureTime,
          rideArrivalTime: created.rideArrivalTime,
          seatNumber: created.seatNumber,
          status: created.status,
          departureStationId: created.departureStationId,
          arrivalStationId: created.arrivalStationId
        });

        return created;
      }
    );

    prismaMock.reservation.update.mockResolvedValue({
      ...baseReservation,
      status: ReservationStatus.CANCELLED,
      cancelledAt: new Date(),
      updatedById: 'manager-1'
    });
  });

  it('fails when seat is already booked on overlapping segment', async () => {
    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 12,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-b',
      arrivalStationId: 'station-d'
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 12,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('names the route problem instead of a seat collision when an existing reservation is off-route', async () => {
    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 5,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-removed',
      arrivalStationId: 'station-d'
    });

    const attempt = () =>
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 12,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      });

    await expect(attempt()).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt()).rejects.toThrow(
      'Cannot confirm seat availability: another reservation on this departure has a station that is no longer on the route. Run the reservation.stationsOnRoute integrity check to find and resolve it.'
    );
  });

  it('fails when departure or arrival is not valid for line path', async () => {
    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-z',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a departure station that is drop-off only', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: {
        ...routeRide.line,
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1, isBoarding: false, isDropoff: true },
          { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: true }
        ]
      }
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-b',
        arrivalStationId: 'station-d'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an arrival station that is boarding only', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: {
        ...routeRide.line,
        intermediateStops: [
          { stationId: 'station-b', orderIndex: 1, isBoarding: true, isDropoff: true },
          { stationId: 'station-c', orderIndex: 2, isBoarding: true, isDropoff: false }
        ]
      }
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 15,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows the line endpoints regardless of intermediate boarding rules', async () => {
    const result = await service.create(auth, {
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: '2026-03-30',
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 21,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    expect(result.departureStationId).toBe('station-a');
    expect(result.arrivalStationId).toBe('station-d');
    expect(result.groupId).toEqual(expect.any(String));
  });

  describe('return legs', () => {
    /** The opposite direction of the same pair: station-d back to station-a. */
    const reversedRide = {
      id: 'ride-return',
      line: {
        isActive: true,
        departureStationId: 'station-d',
        arrivalStationId: 'station-a',
        intermediateStops: [
          { stationId: 'station-c', orderIndex: 1, isBoarding: true, isDropoff: true },
          { stationId: 'station-b', orderIndex: 2, isBoarding: true, isDropoff: true }
        ]
      }
    };

    const createReturnLeg = () =>
      service.create(auth, {
        rideId: 'ride-return',
        passengerId: 'passenger-1',
        travelDate: '2026-04-06',
        rideDepartureTime: '18:00',
        rideArrivalTime: '19:30',
        seatNumber: 12,
        departureStationId: 'station-c',
        arrivalStationId: 'station-a',
        returnOfReservationId: 'reservation-1'
      });

    beforeEach(() => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...reversedRide, capacity: 40 });
    });

    it('links a created return leg to its outbound leg and shares the booking marker', async () => {
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...baseReservation })
        .mockResolvedValueOnce(null);

      const result = await createReturnLeg();

      expect(result.returnOfReservationId).toBe('reservation-1');
      expect(result.roundTripId).toEqual(expect.any(String));
      // The outbound leg was a one-way until now, so it is stamped with the
      // marker the return leg was given rather than being left without one.
      expect(prismaMock.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1' },
          data: expect.objectContaining({ roundTripId: result.roundTripId })
        })
      );
    });

    it('takes the booking marker the outbound leg already carries', async () => {
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...baseReservation, roundTripId: 'booking-1' })
        .mockResolvedValueOnce(null);

      await expect(createReturnLeg()).resolves.toEqual(
        expect.objectContaining({ roundTripId: 'booking-1' })
      );
      expect(prismaMock.reservation.update).not.toHaveBeenCalled();
    });

    it('refuses a return leg whose outbound leg already has a live return', async () => {
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...baseReservation })
        .mockResolvedValueOnce({ id: 'reservation-existing-return' });

      await expect(createReturnLeg()).rejects.toBeInstanceOf(ConflictException);
    });

    it('leaves a one-way reservation without a booking marker', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });

      const result = await service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 31,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      });

      expect(result.roundTripId).toBeNull();
      expect(result.returnOfReservationId).toBeNull();
    });

    it('links an existing reservation to its outbound leg on update', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...baseReservation })
        .mockResolvedValueOnce({
          ...baseReservation,
          id: 'reservation-outbound',
          departureStationId: 'station-c',
          arrivalStationId: 'station-a',
          roundTripId: 'booking-1'
        })
        .mockResolvedValueOnce(null);
      prismaMock.reservation.update.mockResolvedValue({
        ...baseReservation,
        returnOfReservationId: 'reservation-outbound',
        roundTripId: 'booking-1'
      });

      await service.update(auth, 'reservation-1', {
        returnOfReservationId: 'reservation-outbound'
      });

      expect(prismaMock.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'reservation-1' },
          data: expect.objectContaining({
            returnOfReservationId: 'reservation-outbound',
            roundTripId: 'booking-1'
          })
        })
      );
    });

    it('unlinks a return leg when update is given an explicit null', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
      prismaMock.reservation.findFirst.mockResolvedValueOnce({
        ...baseReservation,
        returnOfReservationId: 'reservation-outbound',
        roundTripId: 'booking-1'
      });
      prismaMock.reservation.update.mockResolvedValue({
        ...baseReservation,
        returnOfReservationId: null,
        roundTripId: null
      });

      await service.update(auth, 'reservation-1', { returnOfReservationId: null });

      // The marker assigned when this pair was linked is cleared too.
      expect(prismaMock.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ returnOfReservationId: null, roundTripId: null })
        })
      );
    });

    const linkedReservation = {
      ...baseReservation,
      returnOfReservationId: 'reservation-outbound',
      roundTripId: 'booking-1'
    };

    /** The outbound leg the linked reservation travels back from. */
    const linkedOutbound = {
      ...baseReservation,
      id: 'reservation-outbound',
      departureStationId: 'station-c',
      arrivalStationId: 'station-a',
      roundTripId: 'booking-1'
    };

    it('revalidates a retained link when the passenger changes', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
      prismaMock.passenger.findFirst.mockResolvedValue({ id: 'passenger-2' });
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...linkedReservation })
        .mockResolvedValueOnce({ ...linkedOutbound });

      // The link asserts one passenger across both legs. Moving this leg to
      // another passenger without revalidating would leave that assertion
      // standing and false.
      await expect(
        service.update(auth, 'reservation-1', { passengerId: 'passenger-2' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.reservation.update).not.toHaveBeenCalled();
    });

    it('revalidates a retained link when the stations change', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
      prismaMock.reservation.findFirst
        .mockResolvedValueOnce({ ...linkedReservation })
        .mockResolvedValueOnce({ ...linkedOutbound });

      await expect(
        service.update(auth, 'reservation-1', { arrivalStationId: 'station-d' })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.reservation.update).not.toHaveBeenCalled();
    });

    it('leaves a retained link alone when no field it asserts on changes', async () => {
      prismaMock.ride.findFirst.mockResolvedValue({ ...routeRide, capacity: 40 });
      prismaMock.reservation.findFirst.mockResolvedValueOnce({ ...linkedReservation });
      prismaMock.reservation.update.mockResolvedValue({ ...linkedReservation });

      await service.update(auth, 'reservation-1', { notes: 'Putnik kasni' });

      expect(prismaMock.reservation.findFirst).toHaveBeenCalledTimes(1);
      expect(prismaMock.reservation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ returnOfReservationId: expect.anything() })
        })
      );
    });
  });

  it('refuses to create a reservation on a ride whose line is deactivated', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: { ...routeRide.line, isActive: false }
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 21,
        departureStationId: 'station-a',
        arrivalStationId: 'station-d'
      })
    ).rejects.toThrow('Ride line is deactivated and cannot take new reservations');
  });

  it('still allows editing an existing reservation after its ride line is deactivated', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: { ...routeRide.line, isActive: false }
    });

    await service.update(auth, 'reservation-1', { seatNumber: 20 });

    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reservation-1' },
        data: expect.objectContaining({ seatNumber: 20 })
      })
    );
  });

  it('updates status and audit fields on cancellation', async () => {
    const result = await service.cancel(auth, 'reservation-1');

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'reservation-1'
        },
        data: expect.objectContaining({
          status: ReservationStatus.CANCELLED,
          updatedById: 'admin-1'
        })
      })
    );
    expect(result.status).toBe(ReservationStatus.CANCELLED);
  });

  it('includes only the selected seat’s linked return, even when a party shares a booking marker', async () => {
    const outbound = { ...baseReservation, roundTripId: 'round-trip-1' };
    const returnLeg = {
      ...baseReservation,
      id: 'reservation-return',
      rideId: 'ride-return',
      departureStationId: 'station-c',
      arrivalStationId: 'station-a',
      roundTripId: 'round-trip-1',
      returnOfReservationId: 'reservation-1'
    };
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([outbound])
      .mockResolvedValueOnce([returnLeg]);

    const result = await service.cancellationPreview(auth, {
      reservationIds: ['reservation-1'],
      scope: 'selected'
    });

    expect(result.outboundReservations.map((item) => item.id)).toEqual(['reservation-1']);
    expect(result.returnReservations.map((item) => item.id)).toEqual(['reservation-return']);
    expect(prismaMock.reservation.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          status: ReservationStatus.ACTIVE,
          id: { notIn: ['reservation-1'] },
          OR: [
            { returnOf: { id: { in: ['reservation-1'] } } },
            { returnLegs: { some: { id: { in: ['reservation-1'] } } } }
          ]
        }
      })
    );
  });

  it('finds the outbound when the selected reservation is a return leg', async () => {
    const returnLeg = {
      ...baseReservation,
      id: 'reservation-return',
      returnOfReservationId: 'reservation-1'
    };
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([returnLeg])
      .mockResolvedValueOnce([baseReservation]);

    const result = await service.cancellationPreview(auth, {
      reservationIds: ['reservation-return'],
      scope: 'selected'
    });

    expect(result.outboundReservations.map((item) => item.id)).toEqual(['reservation-return']);
    expect(result.returnReservations.map((item) => item.id)).toEqual(['reservation-1']);
    expect(prismaMock.reservation.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { returnLegs: { some: { id: { in: ['reservation-return'] } } } }
          ])
        })
      })
    );
  });

  it('does not guess a return for an unlinked legacy reservation', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([baseReservation])
      .mockResolvedValueOnce([]);

    const result = await service.cancellationPreview(auth, {
      reservationIds: ['reservation-1'],
      scope: 'selected'
    });

    expect(result.returnReservations).toEqual([]);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledTimes(2);
  });

  it('keeps ungrouped selected reservations and their return legs in group scope', async () => {
    const grouped = { ...baseReservation, groupId: 'group-1' };
    const ungrouped = { ...baseReservation, id: 'reservation-2' };
    const returnLeg = {
      ...baseReservation,
      id: 'reservation-return',
      returnOfReservationId: 'reservation-2'
    };
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([grouped, ungrouped])
      .mockImplementationOnce(async ({ where }: { where: { OR?: Array<{ id?: { in: string[] } }> } }) =>
        where.OR?.some((clause) => clause.id?.in.includes('reservation-2'))
          ? [grouped, ungrouped]
          : [grouped]
      )
      .mockImplementationOnce(async ({ where }: { where: { OR: Array<{ returnOf?: { id: { in: string[] } } }> } }) =>
        where.OR.some((clause) => clause.returnOf?.id.in.includes('reservation-2'))
          ? [returnLeg]
          : []
      );

    const result = await service.cancellationPreview(auth, {
      reservationIds: ['reservation-1', 'reservation-2'],
      scope: 'groups'
    });

    expect(result.outboundReservations.map((item) => item.id)).toEqual([
      'reservation-1',
      'reservation-2'
    ]);
    expect(result.returnReservations.map((item) => item.id)).toEqual(['reservation-return']);
  });

  it('assigns a group to active reservations from one departure atomically', async () => {
    const groupId = 'dd1d9d6b-d10c-4cab-bb6f-a50d59f0f5da';
    const first = { ...baseReservation, groupId: 'old-group' };
    const second = {
      ...baseReservation,
      id: 'reservation-2',
      passengerId: 'passenger-2',
      seatNumber: 13,
      groupId: 'old-group'
    };
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([{ ...first, groupId }, { ...second, groupId }]);
    prismaMock.reservation.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.assignGroup(auth, {
      reservationIds: ['reservation-1', 'reservation-2'],
      groupId
    });

    expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          id: { in: ['reservation-1', 'reservation-2'] },
          status: ReservationStatus.ACTIVE
        },
        data: expect.objectContaining({ groupId, updatedById: 'admin-1' })
      })
    );
    expect(result.map((item) => item.groupId)).toEqual([groupId, groupId]);
  });

  it('rejects group assignment across departures before making any update', async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([
      baseReservation,
      { ...baseReservation, id: 'reservation-2', rideDepartureTime: '15:00' }
    ]);

    await expect(
      service.assignGroup(auth, {
        reservationIds: ['reservation-1', 'reservation-2'],
        groupId: 'dd1d9d6b-d10c-4cab-bb6f-a50d59f0f5da'
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.reservation.updateMany).not.toHaveBeenCalled();
  });

  it('moves a reservation to a free seat under the ride-instance lock', async () => {
    await service.moveSeat(auth, 'reservation-1', 16);

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reservation-1' },
        data: expect.objectContaining({ seatNumber: 16, updatedById: 'admin-1' })
      })
    );
  });

  it('allows moving an existing reservation after its ride line is deactivated', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({
      ...routeRide,
      capacity: 40,
      line: { ...routeRide.line, isActive: false }
    });

    await service.moveSeat(auth, 'reservation-1', 16);

    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reservation-1' },
        data: expect.objectContaining({ seatNumber: 16 })
      })
    );
  });

  it('swaps seats when the destination has an overlapping reservation', async () => {
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ ...baseReservation, id: 'reservation-2', seatNumber: 16 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.moveSeat(auth, 'reservation-1', 16);

    expect(prismaMock.reservation.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'reservation-1' },
        data: expect.objectContaining({ seatNumber: 16 })
      })
    );
    expect(prismaMock.reservation.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'reservation-2' },
        data: expect.objectContaining({ seatNumber: 12 })
      })
    );
  });

  it('uses the source seat read after acquiring the ride-instance lock for a swap', async () => {
    prismaMock.reservation.findFirst
      .mockResolvedValueOnce({ ...baseReservation, seatNumber: 12 })
      .mockResolvedValueOnce({ ...baseReservation, seatNumber: 15 });
    prismaMock.reservation.findMany
      .mockResolvedValueOnce([{ ...baseReservation, id: 'reservation-2', seatNumber: 16 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await service.moveSeat(auth, 'reservation-1', 16);

    expect(prismaMock.reservation.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'reservation-2' },
        data: expect.objectContaining({ seatNumber: 15 })
      })
    );
  });

  it('fails the whole batch and rolls back when one item fails', async () => {
    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 5,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    await expect(
      service.createBatch(auth, {
        items: [
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 6,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          },
          {
            rideId: 'ride-1',
            passengerId: 'passenger-1',
            travelDate: '2026-03-30',
            rideDepartureTime: '09:00',
            rideArrivalTime: '10:30',
            seatNumber: 5,
            departureStationId: 'station-a',
            arrivalStationId: 'station-c'
          }
        ]
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(reservationStore).toHaveLength(1);
  });

  it('stamps the same groupId on all items when travelTogether is true and items.length > 1', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: true,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 1,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 2,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 3,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    const groupIds = result.items.map((item) => item.reservation?.groupId);
    expect(groupIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(groupIds).size).toBe(1);
  });

  it('assigns one group per passenger when travelTogether is false', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: false,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 7,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-2',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 8,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    const groupIds = result.items.map((item) => item.reservation?.groupId);
    expect(groupIds.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(groupIds).size).toBe(2);
  });

  it('reuses the passenger group for several seats when travelTogether is false', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: false,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 9,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 10,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    const groupIds = result.items.map((item) => item.reservation?.groupId);
    expect(groupIds[0]).toEqual(expect.any(String));
    expect(groupIds[1]).toBe(groupIds[0]);
  });

  it('does not reuse a passenger group across different departures in one batch', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: false,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 9,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        },
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-31',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 9,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    const groupIds = result.items.map((item) => item.reservation?.groupId);
    expect(groupIds[0]).toEqual(expect.any(String));
    expect(groupIds[1]).toEqual(expect.any(String));
    expect(groupIds[1]).not.toBe(groupIds[0]);
  });

  it('assigns a group when a batch contains only one item', async () => {
    const result = await service.createBatch(auth, {
      travelTogether: true,
      items: [
        {
          rideId: 'ride-1',
          passengerId: 'passenger-1',
          travelDate: '2026-03-30',
          rideDepartureTime: '09:00',
          rideArrivalTime: '10:30',
          seatNumber: 9,
          departureStationId: 'station-a',
          arrivalStationId: 'station-c'
        }
      ]
    });

    expect(result.items[0].reservation?.groupId).toEqual(expect.any(String));
  });

  it('fails when route segment capacity is exhausted', async () => {
    prismaMock.ride.findFirst.mockResolvedValueOnce({ ...routeRide, capacity: 1 });

    reservationStore.push({
      id: 'reservation-existing',
      tenantId: 'tenant-1',
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: new Date('2026-03-30T00:00:00.000Z'),
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 1,
      status: ReservationStatus.ACTIVE,
      departureStationId: 'station-a',
      arrivalStationId: 'station-d'
    });

    await expect(
      service.create(auth, {
        rideId: 'ride-1',
        passengerId: 'passenger-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        rideArrivalTime: '10:30',
        seatNumber: 1,
        departureStationId: 'station-a',
        arrivalStationId: 'station-c'
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents duplicate same-seat bookings in concurrent requests', async () => {
    const requestPayload = {
      rideId: 'ride-1',
      passengerId: 'passenger-1',
      travelDate: '2026-03-30',
      rideDepartureTime: '09:00',
      rideArrivalTime: '10:30',
      seatNumber: 11,
      departureStationId: 'station-a',
      arrivalStationId: 'station-c'
    };

    const [first, second] = await Promise.allSettled([
      service.create(auth, requestPayload),
      service.create(auth, requestPayload)
    ]);

    const fulfilledCount = [first, second].filter((item) => item.status === 'fulfilled').length;
    const rejectedCount = [first, second].filter((item) => item.status === 'rejected').length;

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);
  });

  it('counts active reservations per ride instance inside the travel-date window', async () => {
    prismaMock.reservation.groupBy.mockResolvedValue([
      {
        rideId: 'ride-1',
        travelDate: new Date('2026-03-30T00:00:00.000Z'),
        rideDepartureTime: '09:00',
        _count: { _all: 12 }
      }
    ]);

    const result = await service.countsByRideInstance(auth, {
      from: '2026-03-30',
      to: '2026-04-30'
    });

    expect(prismaMock.reservation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['rideId', 'travelDate', 'rideDepartureTime'],
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: ReservationStatus.ACTIVE,
          travelDate: {
            gte: new Date('2026-03-30T00:00:00.000Z'),
            lte: new Date('2026-04-30T00:00:00.000Z')
          }
        })
      })
    );

    expect(result.items).toEqual([
      {
        rideId: 'ride-1',
        travelDate: '2026-03-30',
        rideDepartureTime: '09:00',
        activeCount: 12
      }
    ]);
  });

  it('rejects a counts window that ends before it starts', async () => {
    await expect(
      service.countsByRideInstance(auth, { from: '2026-04-30', to: '2026-03-30' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
