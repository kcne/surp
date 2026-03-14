import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RideStatus, RideType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { RideDayTimeInputDto } from './ride-day-time.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateRideDto {
  @ApiPropertyOptional({ example: 'Morning Central Route' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: 'line-id-123' })
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty({ example: 38, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity!: number;

  @ApiProperty({ enum: RideType })
  @IsEnum(RideType)
  type!: RideType;

  @ApiPropertyOptional({ enum: RideStatus, default: RideStatus.DRAFT })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

  @ApiPropertyOptional({ example: '2026-03-14' })
  @IsOptional()
  @IsDateString()
  recurringStartDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  recurringEndDate?: string;

  @ApiPropertyOptional({ example: '2026-03-20' })
  @IsOptional()
  @IsDateString()
  oneTimeDate?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'oneTimeDepartureTime must be in HH:mm format' })
  oneTimeDepartureTime?: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'oneTimeArrivalTime must be in HH:mm format' })
  oneTimeArrivalTime?: string;

  @ApiPropertyOptional({ type: [RideDayTimeInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RideDayTimeInputDto)
  dayTimes?: RideDayTimeInputDto[];
}
