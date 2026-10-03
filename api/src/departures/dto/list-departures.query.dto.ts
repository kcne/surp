import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ListDeparturesQueryDto {
  @ApiProperty({ example: '2026-10-01', description: 'First service date, included.' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @ApiProperty({
    example: '2026-10-31',
    description:
      'Last service date, included. The range covers at most 62 days, both ends included, or 366 with cancelled=true.'
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;

  @ApiPropertyOptional({ description: 'Only departures of this ride.' })
  @IsOptional()
  @IsString()
  @Matches(/^\S+$/, { message: '$property must not be empty or contain whitespace' })
  @MaxLength(64)
  rideId?: string;

  @ApiPropertyOptional({ description: 'Only departures on this line.' })
  @IsOptional()
  @IsString()
  @Matches(/^\S+$/, { message: '$property must not be empty or contain whitespace' })
  @MaxLength(64)
  lineId?: string;

  @ApiPropertyOptional({
    enum: ['true'],
    description:
      'Only departures an operator cancelled, LEGACY ones left out: the few the cancelled-departures page restores from. The range may then cover up to 366 days.'
  })
  @IsOptional()
  @IsIn(['true'])
  cancelled?: 'true';
}
