import { ApiProperty } from '@nestjs/swagger';

export class ReturnRouteGapItemDto {
  @ApiProperty({ example: 'pair-abc' })
  pairKey!: string;

  @ApiProperty({ example: 'Novi Sad - Istanbul Balbus' })
  lineName!: string;

  @ApiProperty({ example: 'Istanbul Balbus - Novi Sad' })
  oppositeLineName!: string;

  @ApiProperty({
    type: [String],
    description:
      'Terminus stations of this line that appear nowhere on the opposite direction, so return tickets to or from them cannot be booked.'
  })
  unreachableStationNames!: string[];
}

export class ReturnRouteGapReportDto {
  @ApiProperty({ example: 5, minimum: 0 })
  scannedPairCount!: number;

  @ApiProperty({ example: 2, minimum: 0 })
  gapCount!: number;

  @ApiProperty({ type: [ReturnRouteGapItemDto] })
  items!: ReturnRouteGapItemDto[];
}
