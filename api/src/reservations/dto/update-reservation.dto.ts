import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateReservationDto {
  @ApiPropertyOptional({ example: 'passenger-id-123' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  passengerId?: string;

  @ApiPropertyOptional({ example: 14, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  seatNumber?: number;

  @ApiPropertyOptional({ example: 'station-id-departure' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  departureStationId?: string;

  @ApiPropertyOptional({ example: 'station-id-arrival' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  arrivalStationId?: string;

  @ApiPropertyOptional({ example: 'Putnik silazi na drugoj stanici', maxLength: 500, nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
