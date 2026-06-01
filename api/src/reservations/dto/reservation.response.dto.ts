import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';

export class ReservationRideSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  lineId!: string;
}

export class ReservationPassengerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  phone!: string;
}

export class ReservationStationSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ReservationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  rideId!: string;

  @ApiProperty()
  passengerId!: string;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty({ example: '2026-03-30' })
  travelDate!: string;

  @ApiProperty({ example: '09:00' })
  rideDepartureTime!: string;

  @ApiProperty({ example: '10:30' })
  rideArrivalTime!: string;

  @ApiProperty({ minimum: 1, maximum: 100 })
  seatNumber!: number;

  @ApiProperty({ enum: ReservationStatus })
  status!: ReservationStatus;

  @ApiProperty({ nullable: true })
  cancelledAt!: Date | null;

  @ApiProperty()
  departureStationId!: string;

  @ApiProperty()
  arrivalStationId!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Correlation id shared by reservations created together as a group' })
  groupId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Per-reservation note shown in driver passenger lists' })
  notes!: string | null;

  @ApiProperty({ type: ReservationRideSummaryDto })
  ride!: ReservationRideSummaryDto;

  @ApiProperty({ type: ReservationPassengerSummaryDto })
  passenger!: ReservationPassengerSummaryDto;

  @ApiProperty({ type: ReservationStationSummaryDto })
  departureStation!: ReservationStationSummaryDto;

  @ApiProperty({ type: ReservationStationSummaryDto })
  arrivalStation!: ReservationStationSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedReservationsResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] })
  items!: ReservationResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  total!: number;
}
