import { ApiProperty } from '@nestjs/swagger';
import { RideExceptionType, RideStatus, RideType } from '@prisma/client';

export class RideLineSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  departureStationId!: string;

  @ApiProperty()
  arrivalStationId!: string;
}

export class RideDayTimeResponseDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  dayOfWeek!: number;

  @ApiProperty({ example: '08:30' })
  departureTime!: string;

  @ApiProperty({ example: '10:00' })
  arrivalTime!: string;
}

export class RideExceptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '2026-03-20' })
  date!: string;

  @ApiProperty({ enum: RideExceptionType })
  type!: RideExceptionType;

  @ApiProperty({ nullable: true })
  departureTime!: string | null;

  @ApiProperty({ nullable: true })
  arrivalTime!: string | null;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class RideResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  lineId!: string;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ minimum: 1 })
  capacity!: number;

  @ApiProperty({ enum: RideType })
  type!: RideType;

  @ApiProperty({ enum: RideStatus })
  status!: RideStatus;

  @ApiProperty({ nullable: true, example: '2026-03-14' })
  recurringStartDate!: string | null;

  @ApiProperty({ nullable: true, example: '2026-06-30' })
  recurringEndDate!: string | null;

  @ApiProperty({ nullable: true, example: '2026-03-20' })
  oneTimeDate!: string | null;

  @ApiProperty({ nullable: true })
  oneTimeDepartureTime!: string | null;

  @ApiProperty({ nullable: true })
  oneTimeArrivalTime!: string | null;

  @ApiProperty({ type: [RideDayTimeResponseDto] })
  dayTimes!: RideDayTimeResponseDto[];

  @ApiProperty({ type: [RideExceptionResponseDto] })
  exceptions!: RideExceptionResponseDto[];

  @ApiProperty({ type: RideLineSummaryDto })
  line!: RideLineSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedRidesResponseDto {
  @ApiProperty({ type: [RideResponseDto] })
  items!: RideResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  total!: number;
}

export class RideInstanceLineSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  departureStationId!: string;

  @ApiProperty()
  arrivalStationId!: string;
}

export class RideInstanceAvailabilitySummaryDto {
  @ApiProperty({ example: 38, minimum: 0 })
  capacity!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  reservedSeats!: number;

  @ApiProperty({ example: 38, minimum: 0 })
  availableSeats!: number;

  @ApiProperty({ example: true })
  hasAvailability!: boolean;
}

export class RideInstanceResponseDto {
  @ApiProperty({ example: 'ride-1:2026-03-30:09:00:BASE' })
  id!: string;

  @ApiProperty({ example: 'ride-1' })
  rideId!: string;

  @ApiProperty({ example: '2026-03-30' })
  date!: string;

  @ApiProperty({ example: '09:00' })
  departureTime!: string;

  @ApiProperty({ example: '10:30' })
  arrivalTime!: string;

  @ApiProperty({ example: 'BASE', enum: ['BASE', 'ADDITIONAL'] })
  source!: 'BASE' | 'ADDITIONAL';

  @ApiProperty({ enum: RideType })
  rideType!: RideType;

  @ApiProperty({ enum: RideStatus })
  status!: RideStatus;

  @ApiProperty({ type: RideInstanceLineSummaryDto })
  line!: RideInstanceLineSummaryDto;

  @ApiProperty({ type: RideInstanceAvailabilitySummaryDto })
  availability!: RideInstanceAvailabilitySummaryDto;

  @ApiProperty({ example: 0, minimum: 0 })
  reservationCount!: number;
}

export class RideInstancesByDateResponseDto {
  @ApiProperty({ example: '2026-03-30' })
  date!: string;

  @ApiProperty({ example: 0 })
  timezoneOffsetMinutes!: number;

  @ApiProperty({ type: [RideInstanceResponseDto] })
  items!: RideInstanceResponseDto[];
}
