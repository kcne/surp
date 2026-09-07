import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDriftItemDto {
  @ApiProperty({ example: 'ride-1' })
  rideId!: string;

  @ApiProperty({ example: 'Novi Sad - Istanbul Balbus' })
  rideName!: string;

  @ApiProperty({ example: 'line-1' })
  lineId!: string;

  @ApiProperty({ example: 'Novi Sad - Istanbul Balbus' })
  lineName!: string;

  @ApiProperty({ example: 1, minimum: 0, maximum: 6 })
  dayOfWeek!: number;

  @ApiProperty({ example: 20, description: 'Station count currently stored on the day schedule.' })
  scheduleStationCount!: number;

  @ApiProperty({ example: 22, description: 'Station count on the line route.' })
  routeStationCount!: number;

  @ApiProperty({
    type: [String],
    description: 'Station names on the route that the schedule is missing.'
  })
  addedStationNames!: string[];

  @ApiProperty({
    type: [String],
    description: 'Station names on the schedule that are no longer on the route.'
  })
  removedStationNames!: string[];

  @ApiProperty({
    type: [String],
    description:
      'Station names the route moved past one another. Their existing times are kept, so after realignment the schedule may read out of sequence and needs review.'
  })
  reorderedStationNames!: string[];
}

export class ScheduleDriftReportDto {
  @ApiProperty({ example: 12, minimum: 0 })
  scannedScheduleCount!: number;

  @ApiProperty({ example: 3, minimum: 0 })
  driftedScheduleCount!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  affectedRideCount!: number;

  @ApiProperty({ type: [ScheduleDriftItemDto] })
  items!: ScheduleDriftItemDto[];
}

export class ScheduleRealignResultDto {
  @ApiProperty({ example: 3, minimum: 0, description: 'Day schedules rewritten to match their route.' })
  realignedScheduleCount!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  affectedRideCount!: number;

  @ApiProperty({
    example: 4,
    minimum: 0,
    description:
      'Station times filled with an estimate rather than a known value. Estimates are a starting point and should be reviewed in the schedule screen.'
  })
  estimatedTimeCount!: number;

  @ApiProperty({
    example: 1,
    minimum: 0,
    description:
      'Schedules whose stops changed order. Their times were carried over unchanged and may now run backwards, so they need review rather than an estimate.'
  })
  reorderedScheduleCount!: number;

  @ApiProperty({ type: [ScheduleDriftItemDto], description: 'What was repaired.' })
  items!: ScheduleDriftItemDto[];
}
