import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LineDirection, LineDirectionMode } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { LineStopInputDto } from './line-stop.dto';

export class CreateLineDto {
  @ApiPropertyOptional({ example: 'Central - North' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'station-departure-id' })
  @IsString()
  @IsNotEmpty()
  departureStationId!: string;

  @ApiProperty({ example: 'station-arrival-id' })
  @IsString()
  @IsNotEmpty()
  arrivalStationId!: string;

  @ApiPropertyOptional({ enum: LineDirectionMode, default: LineDirectionMode.BOTH })
  @IsOptional()
  @IsEnum(LineDirectionMode)
  directionMode?: LineDirectionMode;

  @ApiPropertyOptional({ enum: LineDirection, default: LineDirection.OUTBOUND })
  @IsOptional()
  @IsEnum(LineDirection)
  direction?: LineDirection;

  @ApiPropertyOptional({ example: 'seed-station-main-seed-station-referenced-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  pairKey?: string;

  @ApiPropertyOptional({ example: true, default: true })
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
