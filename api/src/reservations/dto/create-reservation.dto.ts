import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateReservationDto {
  @ApiProperty({ example: 'ride-id-123' })
  @IsString()
  @IsNotEmpty()
  rideId!: string;

  @ApiProperty({ example: 'passenger-id-123' })
  @IsString()
  @IsNotEmpty()
  passengerId!: string;

  @ApiProperty({ example: '2026-03-30' })
  @IsDateString()
  travelDate!: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'rideDepartureTime must be in HH:mm format' })
  rideDepartureTime!: string;

  @ApiProperty({ example: '10:30' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'rideArrivalTime must be in HH:mm format' })
  rideArrivalTime!: string;

  @ApiProperty({ example: 12, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  seatNumber!: number;

  @ApiProperty({ example: 'station-id-departure' })
  @IsString()
  @IsNotEmpty()
  departureStationId!: string;

  @ApiProperty({ example: 'station-id-arrival' })
  @IsString()
  @IsNotEmpty()
  arrivalStationId!: string;
}
