import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ListReservationCountsQueryDto {
  @ApiProperty({ example: '2026-03-30', description: 'First travel date to count, inclusive.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from must be in YYYY-MM-DD format' })
  from!: string;

  @ApiProperty({ example: '2026-06-30', description: 'Last travel date to count, inclusive.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'to must be in YYYY-MM-DD format' })
  to!: string;

  @ApiPropertyOptional({ example: 'ride-id-123' })
  @IsOptional()
  @IsString()
  rideId?: string;
}
