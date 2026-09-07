import {
  buildAlignedStationTimes,
  describeScheduleDrift,
  realignDaySchedulesTx
} from './ride-schedule-alignment';

describe('buildAlignedStationTimes', () => {
  const times = (entries: Array<[string, string | null]>) =>
    entries.map(([stationId, time], index) => ({ stationId, orderIndex: index, time }));

  it('spreads a stop inserted between two known times across the gap', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'new', 'b'],
      times([
        ['a', '08:00'],
        ['b', '09:00']
      ])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['08:00', '08:30', '09:00']);
    expect(aligned.map((entry) => entry.isEstimated)).toEqual([false, true, false]);
  });

  it('spreads several consecutive new stops evenly', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'x', 'y', 'b'],
      times([
        ['a', '10:00'],
        ['b', '11:00']
      ])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['10:00', '10:20', '10:40', '11:00']);
  });

  it('adds 15 minutes per stop when only a preceding time is known', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'x', 'y'],
      times([['a', '22:00']])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['22:00', '22:15', '22:30']);
  });

  it('subtracts 15 minutes per stop when only a following time is known', () => {
    const aligned = buildAlignedStationTimes(
      ['x', 'y', 'b'],
      times([['b', '06:00']])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['05:30', '05:45', '06:00']);
  });

  it('keeps estimates inside the day when a leg runs past midnight', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'new', 'b'],
      times([
        ['a', '23:00'],
        ['b', '01:00']
      ])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['23:00', '00:00', '01:00']);
  });

  it('wraps correctly when adding past midnight from a preceding time only', () => {
    const aligned = buildAlignedStationTimes(['a', 'x'], times([['a', '23:50']]));

    expect(aligned.map((entry) => entry.time)).toEqual(['23:50', '00:05']);
  });

  it('preserves existing times and reorders them to the route', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'c', 'b'],
      times([
        ['a', '08:00'],
        ['b', '10:00'],
        ['c', '09:00']
      ])
    );

    expect(aligned.map((entry) => entry.time)).toEqual(['08:00', '09:00', '10:00']);
    expect(aligned.every((entry) => !entry.isEstimated)).toBe(true);
  });

  it('leaves times null when the schedule has nothing to anchor an estimate to', () => {
    const aligned = buildAlignedStationTimes(
      ['a', 'b'],
      times([
        ['a', null],
        ['b', null]
      ])
    );

    expect(aligned.map((entry) => entry.time)).toEqual([null, null]);
    expect(aligned.every((entry) => !entry.isEstimated)).toBe(true);
  });
});

describe('describeScheduleDrift', () => {
  const times = (stationIds: string[]) =>
    stationIds.map((stationId, index) => ({ stationId, orderIndex: index, time: null }));

  it('reports a station added to the route', () => {
    const drift = describeScheduleDrift(times(['a', 'b']), ['a', 'new', 'b']);

    expect(drift.addedStationIds).toEqual(['new']);
    expect(drift.removedStationIds).toEqual([]);
    expect(drift.reorderedStationIds).toEqual([]);
  });

  it('reports a station dropped from the route', () => {
    const drift = describeScheduleDrift(times(['a', 'gone', 'b']), ['a', 'b']);

    expect(drift.addedStationIds).toEqual([]);
    expect(drift.removedStationIds).toEqual(['gone']);
    expect(drift.reorderedStationIds).toEqual([]);
  });

  it('reports the stop the route moved, not every stop past it', () => {
    // b travelled from the middle to the end; a and c kept their order.
    const drift = describeScheduleDrift(times(['a', 'b', 'c']), ['a', 'c', 'b']);

    expect(drift.reorderedStationIds).toEqual(['b']);
  });

  it('treats a pure insertion as no reorder at all', () => {
    const drift = describeScheduleDrift(times(['a', 'b', 'c']), ['a', 'x', 'b', 'y', 'c']);

    expect(drift.addedStationIds).toEqual(['x', 'y']);
    expect(drift.reorderedStationIds).toEqual([]);
  });
});

describe('realignDaySchedulesTx', () => {
  const buildTx = () => ({
    rideDayScheduleStationTime: {
      deleteMany: jest.fn(),
      createMany: jest.fn()
    }
  });

  const scheduleOf = (id: string, stationIds: string[], routeStationIds: string[]) => ({
    rideDayScheduleId: id,
    stationTimes: stationIds.map((stationId, index) => ({
      stationId,
      orderIndex: index,
      time: index === 0 ? '08:00' : null
    })),
    routeStationIds
  });

  it('rewrites many schedules in a single delete and a single insert', async () => {
    const tx = buildTx();

    const result = await realignDaySchedulesTx(tx as never, {
      tenantId: 'tenant-1',
      actorId: 'user-1',
      schedules: [
        scheduleOf('schedule-1', ['a', 'b'], ['a', 'new', 'b']),
        scheduleOf('schedule-2', ['a', 'b'], ['a', 'new', 'b'])
      ]
    });

    expect(tx.rideDayScheduleStationTime.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.rideDayScheduleStationTime.deleteMany).toHaveBeenCalledWith({
      where: { rideDayScheduleId: { in: ['schedule-1', 'schedule-2'] }, tenantId: 'tenant-1' }
    });

    expect(tx.rideDayScheduleStationTime.createMany).toHaveBeenCalledTimes(1);
    const [{ data }] = tx.rideDayScheduleStationTime.createMany.mock.calls[0];
    expect(data).toHaveLength(6);
    expect(data.every((row: { createdById: string }) => row.createdById === 'user-1')).toBe(true);

    expect(result.realignedScheduleCount).toBe(2);
    expect(result.reorderedScheduleIds).toEqual([]);
  });

  it('touches nothing when there is no drifted schedule', async () => {
    const tx = buildTx();

    const result = await realignDaySchedulesTx(tx as never, {
      tenantId: 'tenant-1',
      actorId: 'user-1',
      schedules: []
    });

    expect(tx.rideDayScheduleStationTime.deleteMany).not.toHaveBeenCalled();
    expect(tx.rideDayScheduleStationTime.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      realignedScheduleCount: 0,
      estimatedTimeCount: 0,
      reorderedScheduleIds: []
    });
  });

  it('flags a schedule whose stops the route reordered, since its times are carried over', async () => {
    const tx = buildTx();

    const result = await realignDaySchedulesTx(tx as never, {
      tenantId: 'tenant-1',
      actorId: 'user-1',
      schedules: [scheduleOf('schedule-1', ['a', 'b', 'c'], ['a', 'c', 'b'])]
    });

    expect(result.reorderedScheduleIds).toEqual(['schedule-1']);
  });
});
