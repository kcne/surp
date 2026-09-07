import { ApiProperty } from '@nestjs/swagger';

export class PairDriftLineDto {
  @ApiProperty({ example: 'line-1' })
  id!: string;

  @ApiProperty({ example: 'Novi Sad - Istanbul Balbus' })
  name!: string;

  @ApiProperty({ example: 20, description: 'Intermediate stop count on this direction.' })
  stopCount!: number;

  @ApiProperty({
    type: [String],
    description: 'Stations the other direction has that this one is missing.'
  })
  missingStationNames!: string[];
}

export class PairDriftItemDto {
  @ApiProperty({ example: 'pair-abc' })
  pairKey!: string;

  @ApiProperty({ type: PairDriftLineDto })
  outbound!: PairDriftLineDto;

  @ApiProperty({ type: PairDriftLineDto })
  inbound!: PairDriftLineDto;

  @ApiProperty({
    example: true,
    description:
      'True when one direction is simply missing stops the other has, which can be synced automatically.'
  })
  canAutoSync!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Why the pair cannot be synced automatically, when it cannot.'
  })
  conflictReason!: string | null;
}

export class PairDriftReportDto {
  @ApiProperty({ example: 5, minimum: 0 })
  scannedPairCount!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  driftedPairCount!: number;

  @ApiProperty({ type: [PairDriftItemDto] })
  items!: PairDriftItemDto[];
}

export class PairSyncResultDto {
  @ApiProperty({ example: 2, minimum: 0 })
  syncedPairCount!: number;

  @ApiProperty({ example: 3, minimum: 0, description: 'Stops added across both directions.' })
  addedStopCount!: number;

  @ApiProperty({
    example: 2,
    minimum: 0,
    description: 'Ride day schedules realigned as a result of the route changes.'
  })
  realignedScheduleCount!: number;

  @ApiProperty({
    example: 0,
    minimum: 0,
    description: 'Pairs left untouched because their directions genuinely disagree.'
  })
  skippedPairCount!: number;

  @ApiProperty({ type: [PairDriftItemDto] })
  items!: PairDriftItemDto[];
}
