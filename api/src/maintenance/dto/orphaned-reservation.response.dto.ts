import { ApiProperty } from '@nestjs/swagger';

export class OrphanedReservationItemDto {
  @ApiProperty({ example: 'reservation-id-123' })
  reservationId!: string;

  @ApiProperty({ example: 'Marko Markovic' })
  passengerName!: string;

  @ApiProperty({ example: '+381601234567' })
  passengerPhone!: string;

  @ApiProperty({ example: '2026-09-15' })
  travelDate!: string;

  @ApiProperty({ example: 'Istanbul Balbus - Novi Sad' })
  rideName!: string;

  @ApiProperty({ example: 'Montenegro - Novi Sad' })
  lineName!: string;

  @ApiProperty({ example: 'Agencija' })
  departureStationName!: string;

  @ApiProperty({ example: 'Novi Sad' })
  arrivalStationName!: string;

  @ApiProperty({ example: '07:45', description: 'Departure time stored on the reservation.' })
  currentDepartureTime!: string;

  @ApiProperty({
    type: String,
    example: '07:30',
    nullable: true,
    description: 'Departure time of the single instance that can claim it, when there is one.'
  })
  targetDepartureTime!: string | null;

  @ApiProperty({ type: String, example: '23:00', nullable: true })
  targetArrivalTime!: string | null;

  @ApiProperty({ example: 12 })
  seatNumber!: number;

  @ApiProperty({
    type: Number,
    example: 31,
    nullable: true,
    description:
      'Seat the reservation would take after repair. Differs from seatNumber when the original seat was sold again while this reservation was invisible; null when the target instance is full.'
  })
  targetSeatNumber!: number | null;

  @ApiProperty({
    enum: ['DEPARTURE_TIME_MOVED', 'AMBIGUOUS_INSTANCE', 'NO_INSTANCE', 'RIDE_NOT_ACTIVE'],
    example: 'DEPARTURE_TIME_MOVED'
  })
  reason!: string;

  @ApiProperty({ example: true })
  canRepair!: boolean;

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Reservation stations that are no longer on the ride route, if any.'
  })
  offRouteStationNames!: string[];
}

export class OrphanedReservationReportDto {
  @ApiProperty({ example: '2026-09-10' })
  windowStartDate!: string;

  @ApiProperty({ example: '2026-10-10' })
  windowEndDate!: string;

  @ApiProperty({ example: 201, description: 'Active reservations travelling inside the window.' })
  scannedReservationCount!: number;

  @ApiProperty({ example: 93 })
  orphanedCount!: number;

  @ApiProperty({ example: 93, description: 'Orphans a single instance can claim.' })
  repairableCount!: number;

  @ApiProperty({ example: 40, description: 'Repairable orphans whose seat number would change.' })
  seatChangeCount!: number;

  @ApiProperty({ type: [OrphanedReservationItemDto] })
  items!: OrphanedReservationItemDto[];
}

export class OrphanedReservationRepairResultDto {
  @ApiProperty({ example: 93 })
  repairedCount!: number;

  @ApiProperty({ example: 40 })
  seatChangedCount!: number;

  @ApiProperty({
    example: 0,
    description: 'Orphans left untouched because no single instance could claim them.'
  })
  skippedCount!: number;

  @ApiProperty({ type: [OrphanedReservationItemDto] })
  items!: OrphanedReservationItemDto[];
}
