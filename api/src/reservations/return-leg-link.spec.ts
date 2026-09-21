import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { linkReturnLeg, ReturnLegCandidate } from './return-leg-link';

const txMock = {
  reservation: {
    findFirst: jest.fn(),
    update: jest.fn()
  }
};

const tx = txMock as unknown as Prisma.TransactionClient;

const dateOf = (value: string) => new Date(`${value}T00:00:00.000Z`);

const outbound = (overrides: Record<string, unknown> = {}) => ({
  id: 'res-outbound',
  tenantId: 'tenant-1',
  passengerId: 'passenger-1',
  departureStationId: 'station-novi-sad',
  arrivalStationId: 'station-budva',
  travelDate: dateOf('2026-10-01'),
  rideDepartureTime: '07:30',
  status: 'ACTIVE',
  roundTripId: null,
  ...overrides
});

const returnLeg = (overrides: Partial<ReturnLegCandidate> = {}): ReturnLegCandidate => ({
  passengerId: 'passenger-1',
  departureStationId: 'station-budva',
  arrivalStationId: 'station-novi-sad',
  travelDate: dateOf('2026-10-08'),
  rideDepartureTime: '20:30',
  ...overrides
});

const link = (leg: ReturnLegCandidate = returnLeg(), excludeReservationId?: string) =>
  linkReturnLeg(tx, {
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    outboundReservationId: 'res-outbound',
    leg,
    excludeReservationId
  });

/** First findFirst loads the outbound leg, second looks for a rival return leg. */
const resolveLookups = (outboundRow: unknown, rivalReturnLeg: unknown = null) => {
  txMock.reservation.findFirst
    .mockResolvedValueOnce(outboundRow)
    .mockResolvedValueOnce(rivalReturnLeg);
};

describe('linkReturnLeg', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: a test that rejects early leaves its
    // second queued mockResolvedValueOnce unconsumed, and clearAllMocks would
    // hand that leftover to the next test's outbound lookup.
    jest.resetAllMocks();
  });

  it('links the two legs and mints a booking marker the outbound leg did not have', async () => {
    resolveLookups(outbound());

    await expect(link()).resolves.toEqual({
      returnOfReservationId: 'res-outbound',
      roundTripId: expect.any(String)
    });

    expect(txMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'res-outbound' },
        data: expect.objectContaining({ roundTripId: expect.any(String) })
      })
    );
  });

  it('reuses the booking marker already on the outbound leg', async () => {
    resolveLookups(outbound({ roundTripId: 'booking-1' }));

    await expect(link()).resolves.toEqual({
      returnOfReservationId: 'res-outbound',
      roundTripId: 'booking-1'
    });

    expect(txMock.reservation.update).not.toHaveBeenCalled();
  });

  it('accepts a return leg departing later the same day', async () => {
    resolveLookups(outbound());

    await expect(
      link(returnLeg({ travelDate: dateOf('2026-10-01'), rideDepartureTime: '20:30' }))
    ).resolves.toEqual(expect.objectContaining({ returnOfReservationId: 'res-outbound' }));
  });

  it('refuses an outbound leg from another tenant', async () => {
    resolveLookups(null);

    await expect(link()).rejects.toBeInstanceOf(NotFoundException);
    expect(txMock.reservation.update).not.toHaveBeenCalled();
  });

  it('refuses to attach a return leg to a cancelled reservation', async () => {
    resolveLookups(outbound({ status: 'CANCELLED' }));

    await expect(link()).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a return leg belonging to a different passenger', async () => {
    resolveLookups(outbound());

    await expect(link(returnLeg({ passengerId: 'passenger-2' }))).rejects.toThrow(
      'same passenger'
    );
  });

  it('refuses a return leg that is not the reversed station pair', async () => {
    resolveLookups(outbound());

    await expect(
      link(returnLeg({ departureStationId: 'station-nis' }))
    ).rejects.toThrow('opposite direction');
  });

  it('refuses a return leg departing before its outbound leg', async () => {
    resolveLookups(outbound());

    await expect(
      link(returnLeg({ travelDate: dateOf('2026-09-30') }))
    ).rejects.toThrow('cannot depart before');
  });

  it('refuses a return leg departing earlier on the same day as its outbound leg', async () => {
    resolveLookups(outbound());

    await expect(
      link(returnLeg({ travelDate: dateOf('2026-10-01'), rideDepartureTime: '06:00' }))
    ).rejects.toThrow('cannot depart before');
  });

  it('refuses a second live return leg for the same outbound leg', async () => {
    resolveLookups(outbound(), { id: 'res-existing-return' });

    await expect(link()).rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores the reservation being updated when looking for a rival return leg', async () => {
    resolveLookups(outbound({ roundTripId: 'booking-1' }));

    await expect(link(returnLeg(), 'res-return')).resolves.toEqual({
      returnOfReservationId: 'res-outbound',
      roundTripId: 'booking-1'
    });

    expect(txMock.reservation.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'res-return' } })
      })
    );
  });

  it('refuses to make a reservation its own return leg', async () => {
    await expect(link(returnLeg(), 'res-outbound')).rejects.toThrow('its own return leg');
    expect(txMock.reservation.findFirst).not.toHaveBeenCalled();
  });
});
