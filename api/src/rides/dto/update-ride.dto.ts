import { ApiPropertyOptional } from '@nestjs/swagger';
import { RideStatus, RideType } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { RideDayScheduleInputDto } from './ride-day-time.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateRideDto {
  @ApiPropertyOptional({ example: 'Morning Central Route Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'line-id-123' })
  @IsOptional()
  @IsString()
  lineId?: string;

  @ApiPropertyOptional({ example: 42, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({ enum: RideType })
  @IsOptional()
  @IsEnum(RideType)
  type?: RideType;

  @ApiPropertyOptional({ enum: RideStatus })
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
  @Matches(TIME_PATTERN, { message: 'oneTimeDepartureTime must be in HH:mm format' })
  oneTimeDepartureTime?: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'oneTimeArrivalTime must be in HH:mm format' })
  oneTimeArrivalTime?: string;

  @ApiPropertyOptional({ type: [RideDayScheduleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RideDayScheduleInputDto)
  daySchedules?: RideDayScheduleInputDto[];
}
