import { ApiProperty } from '@nestjs/swagger';
import { DepartureSource } from '@prisma/client';

export class DepartureStopResponseDto {
  @ApiProperty()
  stationId!: string;

  @ApiProperty()
  stationName!: string;

  @ApiProperty({ example: 0 })
  orderIndex!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '09:00',
    description: 'Null on a middle stop of an extra bus or a one-time ride, which has no time of its own.'
  })
  time!: string | null;

  @ApiProperty()
  isBoarding!: boolean;

  @ApiProperty()
  isDropoff!: boolean;
}

export class DepartureResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  rideId!: string;

  @ApiProperty()
  rideName!: string;

  @ApiProperty()
  lineId!: string;

  @ApiProperty()
  lineName!: string;

  @ApiProperty({ example: '2026-10-01' })
  serviceDate!: string;

  @ApiProperty({
    enum: DepartureSource,
    description:
      'SCHEDULE comes from the timetable, EXTRA is an extra bus or a one-time ride, and LEGACY holds ' +
      'past reservations that match no timetable departure. LEGACY departures never run.'
  })
  source!: DepartureSource;

  @ApiProperty({ example: '09:00' })
  departureTime!: string;

  @ApiProperty({ example: '11:00' })
  arrivalTime!: string;

  @ApiProperty({ example: 48 })
  capacity!: number;

  @ApiProperty({ example: 12, description: 'ACTIVE reservations on this departure.' })
  activeReservationCount!: number;

  @ApiProperty({
    example: 36,
    description: 'Capacity less the ACTIVE reservations, never below 0. Counts whole-bus seats, not stretches.'
  })
  availableSeats!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Set when the timetable no longer has this departure but passengers are still booked on it.'
  })
  timetableDroppedAt!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Set when an operator cancelled this departure.'
  })
  cancelledAt!: Date | null;

  @ApiProperty({ type: String, nullable: true })
  cancelledById!: string | null;

  @ApiProperty({
    type: [DepartureStopResponseDto],
    description: 'Ordered by orderIndex. Empty on a LEGACY departure, which stores no route.'
  })
  stops!: DepartureStopResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class DepartureListResponseDto {
  @ApiProperty({ example: '2026-10-01' })
  from!: string;

  @ApiProperty({ example: '2026-10-31' })
  to!: string;

  @ApiProperty({
    type: [DepartureResponseDto],
    description: 'Ordered by service date, then departure time.'
  })
  items!: DepartureResponseDto[];
}
