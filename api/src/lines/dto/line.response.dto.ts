import { ApiProperty } from '@nestjs/swagger';
import { LineDirection, LineDirectionMode, StationCategory } from '@prisma/client';

export class LineStationSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ enum: StationCategory, nullable: true })
  category!: StationCategory | null;

  @ApiProperty()
  isActive!: boolean;
}

export class LineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  departureStationId!: string;

  @ApiProperty()
  arrivalStationId!: string;

  @ApiProperty({ enum: LineDirectionMode })
  directionMode!: LineDirectionMode;

  @ApiProperty({ enum: LineDirection })
  direction!: LineDirection;

  @ApiProperty({ nullable: true })
  pairKey!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: LineStationSummaryDto })
  departureStation!: LineStationSummaryDto;

  @ApiProperty({ type: LineStationSummaryDto })
  arrivalStation!: LineStationSummaryDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedLinesResponseDto {
  @ApiProperty({ type: [LineResponseDto] })
  items!: LineResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  total!: number;
}
