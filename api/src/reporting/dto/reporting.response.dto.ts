import { ApiProperty } from '@nestjs/swagger';
import { AuditEntity } from './reporting-audit.query.dto';

export class DateRangeResponseDto {
  @ApiProperty({ example: '2026-03-01' })
  fromDate!: string;

  @ApiProperty({ example: '2026-03-31' })
  toDate!: string;
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ example: 6 })
  activeRides!: number;

  @ApiProperty({ example: 4 })
  activeLines!: number;

  @ApiProperty({ example: 8 })
  totalStations!: number;

  @ApiProperty({ example: 127 })
  totalPassengers!: number;

  @ApiProperty({ example: 112 })
  activePassengers!: number;

  @ApiProperty({ example: 240 })
  totalReservations!: number;

  @ApiProperty({ example: 212 })
  activeReservations!: number;

  @ApiProperty({ example: 28 })
  cancelledReservations!: number;

  @ApiProperty({ example: 95 })
  uniqueBookedPassengers!: number;

  @ApiProperty({ example: 68.57 })
  utilizationPercent!: number;
}

export class DailyReservationPointResponseDto {
  @ApiProperty({ example: '2026-03-12' })
  date!: string;

  @ApiProperty({ example: 21 })
  totalReservations!: number;

  @ApiProperty({ example: 18 })
  activeReservations!: number;

  @ApiProperty({ example: 3 })
  cancelledReservations!: number;
}

export class TopLineMetricResponseDto {
  @ApiProperty({ example: 'line-1' })
  lineId!: string;

  @ApiProperty({ example: 'Central - North' })
  lineName!: string;

  @ApiProperty({ example: 75 })
  totalReservations!: number;

  @ApiProperty({ example: 68 })
  activeReservations!: number;

  @ApiProperty({ example: 7 })
  cancelledReservations!: number;

  @ApiProperty({ example: 12 })
  uniqueRideInstances!: number;

  @ApiProperty({ example: 69.23 })
  utilizationPercent!: number;
}

export class ReportingDashboardResponseDto {
  @ApiProperty({ type: DateRangeResponseDto })
  range!: DateRangeResponseDto;

  @ApiProperty({ type: DashboardSummaryResponseDto })
  summary!: DashboardSummaryResponseDto;

  @ApiProperty({ type: [DailyReservationPointResponseDto] })
  dailyReservations!: DailyReservationPointResponseDto[];

  @ApiProperty({ type: [TopLineMetricResponseDto] })
  topLines!: TopLineMetricResponseDto[];
}

export class OccupancyPointResponseDto {
  @ApiProperty({ example: '2026-03-12' })
  date!: string;

  @ApiProperty({ example: 'line-1' })
  lineId!: string;

  @ApiProperty({ example: 'Central - North' })
  lineName!: string;

  @ApiProperty({ example: 18 })
  activeReservations!: number;

  @ApiProperty({ example: 3 })
  cancelledReservations!: number;

  @ApiProperty({ example: 30 })
  totalCapacity!: number;

  @ApiProperty({ example: 60 })
  utilizationPercent!: number;
}

export class OccupancySummaryResponseDto {
  @ApiProperty({ example: 240 })
  totalActiveReservations!: number;

  @ApiProperty({ example: 360 })
  totalCapacity!: number;

  @ApiProperty({ example: 66.67 })
  overallUtilizationPercent!: number;
}

export class ReportingOccupancyResponseDto {
  @ApiProperty({ type: DateRangeResponseDto })
  range!: DateRangeResponseDto;

  @ApiProperty({ nullable: true, example: 'line-1' })
  lineId!: string | null;

  @ApiProperty({ type: OccupancySummaryResponseDto })
  summary!: OccupancySummaryResponseDto;

  @ApiProperty({ type: [OccupancyPointResponseDto] })
  points!: OccupancyPointResponseDto[];
}

export class AuditItemResponseDto {
  @ApiProperty({ enum: AuditEntity })
  entity!: AuditEntity;

  @ApiProperty({ example: 'reservation-1' })
  entityId!: string;

  @ApiProperty({ example: 'UPDATED', enum: ['CREATED', 'UPDATED'] })
  action!: 'CREATED' | 'UPDATED';

  @ApiProperty({ nullable: true, example: 'admin-1' })
  actorUserId!: string | null;

  @ApiProperty({ nullable: true, example: 'admin-1' })
  createdById!: string | null;

  @ApiProperty({ nullable: true, example: 'manager-1' })
  updatedById!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  changedAt!: Date;
}

export class ReportingAuditResponseDto {
  @ApiProperty({ nullable: true, enum: AuditEntity })
  entity!: AuditEntity | null;

  @ApiProperty({ nullable: true })
  actorUserId!: string | null;

  @ApiProperty({ type: DateRangeResponseDto })
  range!: DateRangeResponseDto;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ type: [AuditItemResponseDto] })
  items!: AuditItemResponseDto[];
}
