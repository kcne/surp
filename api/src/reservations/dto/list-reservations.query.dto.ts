import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ListReservationsQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ example: 'ride-id-123' })
  @IsOptional()
  @IsString()
  rideId?: string;

  @ApiPropertyOptional({ example: 'passenger-id-123' })
  @IsOptional()
  @IsString()
  passengerId?: string;

  @ApiPropertyOptional({ example: '2026-03-30' })
  @IsOptional()
  @IsDateString()
  travelDate?: string;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'rideDepartureTime must be in HH:mm format' })
  rideDepartureTime?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
