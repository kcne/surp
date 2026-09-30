import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ListDeparturesQueryDto {
  @ApiProperty({ example: '2026-10-01', description: 'First service date, included.' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'Last service date, included. At most 62 days from `from`, both ends counted.'
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional({ description: 'Only departures of this ride.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  rideId?: string;

  @ApiPropertyOptional({ description: 'Only departures on this line.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lineId?: string;
}
