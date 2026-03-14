import { ApiPropertyOptional } from '@nestjs/swagger';
import { LineDirection, LineDirectionMode } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { LineStopInputDto } from './line-stop.dto';

export class UpdateLineDto {
  @ApiPropertyOptional({ example: 'Central - North Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'station-departure-id' })
  @IsOptional()
  @IsString()
  departureStationId?: string;

  @ApiPropertyOptional({ example: 'station-arrival-id' })
  @IsOptional()
  @IsString()
  arrivalStationId?: string;

  @ApiPropertyOptional({ enum: LineDirectionMode })
  @IsOptional()
  @IsEnum(LineDirectionMode)
  directionMode?: LineDirectionMode;

  @ApiPropertyOptional({ enum: LineDirection })
  @IsOptional()
  @IsEnum(LineDirection)
  direction?: LineDirection;

  @ApiPropertyOptional({ example: 'seed-station-main-seed-station-referenced-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pairKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [LineStopInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineStopInputDto)
  intermediateStops?: LineStopInputDto[];
}
