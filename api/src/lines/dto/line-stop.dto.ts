import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';

export class LineStopInputDto {
  @ApiProperty({ example: 'station-intermediate-id' })
  @IsString()
  @IsNotEmpty()
  stationId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex!: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether passengers may board at this stop.'
  })
  @IsOptional()
  @IsBoolean()
  isBoarding?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether passengers may get off at this stop.'
  })
  @IsOptional()
  @IsBoolean()
  isDropoff?: boolean;
}

export class ReplaceLineStopsDto {
  @ApiProperty({ type: [LineStopInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineStopInputDto)
  intermediateStops!: LineStopInputDto[];
}
