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
