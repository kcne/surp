import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf
} from 'class-validator';

export class UpdateReservationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Booking group shared by reservations travelling together.' })
  @IsOptional()
  @IsUUID()
  groupId?: string;
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

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description:
      'Links this reservation to the outbound leg it travels back from, or unlinks it when null. ' +
      'The outbound leg must be active, belong to the same passenger, travel the reversed station ' +
      'pair, and have no other active return leg.'
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  returnOfReservationId?: string | null;
}
