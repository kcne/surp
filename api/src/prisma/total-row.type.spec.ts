import { Prisma } from '@prisma/client';
import { TotalRow } from './total-row.type';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type LineStopMutableColumns = keyof TotalRow<
  Prisma.LineStopUncheckedCreateInput,
  'id' | 'tenantId' | 'lineId' | 'createdById' | 'updatedById' | 'createdAt' | 'updatedAt'
>;
type ScheduleMutableColumns = keyof TotalRow<
  Prisma.RideDayScheduleUncheckedCreateInput,
  | 'id'
  | 'tenantId'
  | 'rideId'
  | 'createdById'
  | 'updatedById'
  | 'createdAt'
  | 'updatedAt'
  | 'stationTimes'
>;
type StationTimeMutableColumns = keyof TotalRow<
  Prisma.RideDayScheduleStationTimeUncheckedCreateInput,
  | 'id'
  | 'tenantId'
  | 'rideDayScheduleId'
  | 'createdById'
  | 'updatedById'
  | 'createdAt'
  | 'updatedAt'
>;

// These assertions intentionally fail compilation when a mutable schema field
// is added. Updating a delete-and-rewrite writer and this inventory is one
// reviewable change, rather than silently accepting the column default.
type LineStopWriterIsTotal = Expect<
  Equal<LineStopMutableColumns, 'stationId' | 'orderIndex' | 'isBoarding' | 'isDropoff'>
>;
type ScheduleWriterIsTotal = Expect<Equal<ScheduleMutableColumns, 'dayOfWeek'>>;
type StationTimeWriterIsTotal = Expect<
  Equal<StationTimeMutableColumns, 'stationId' | 'orderIndex' | 'time'>
>;

describe('total rewrite row types', () => {
  it('keeps compile-time mutable-column inventories in the test suite', () => {
    const assertions: [LineStopWriterIsTotal, ScheduleWriterIsTotal, StationTimeWriterIsTotal] = [
      true,
      true,
      true
    ];

    expect(assertions).toEqual([true, true, true]);
  });
});
