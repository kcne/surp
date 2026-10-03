import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ConfirmBreakingChangeDto } from '../../invariants/dto/confirm-breaking-change.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cancelling a departure: the answers to the refusal that lists its passengers. */
export class CancelDepartureDto extends ConfirmBreakingChangeDto {}

export class CreateExtraDepartureDto {
  @ApiProperty({ description: 'The ride the extra bus runs for. It follows that ride\'s line and stops.' })
  @IsString()
  @Matches(/^\S+$/, { message: '$property must not be empty or contain whitespace' })
  @MaxLength(64)
  rideId!: string;

  @ApiProperty({
    example: '2026-10-05',
    description: "Service date, from the agency's today to 365 days ahead."
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  serviceDate!: string;

  @ApiProperty({
    example: '15:00',
    description: 'Time at the first stop. Another bus of the ride may leave at the same time that day.'
  })
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiProperty({ example: '17:00', description: 'Time at the last stop. Overnight is allowed.' })
  @Matches(TIME_PATTERN, { message: 'arrivalTime must be in HH:mm format' })
  arrivalTime!: string;

  @ApiPropertyOptional({ example: 48, description: "Seats. The ride's capacity when omitted." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;
}

export class UpdateExtraDepartureDto extends ConfirmBreakingChangeDto {
  @ApiPropertyOptional({
    example: '15:30',
    description: 'New time at the first stop. Reservations on the bus follow it, once confirmed.'
  })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime?: string;

  @ApiPropertyOptional({ example: '17:30', description: 'New time at the last stop.' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'arrivalTime must be in HH:mm format' })
  arrivalTime?: string;

  @ApiPropertyOptional({
    example: 40,
    description: 'New number of seats. Below a booked seat number it is refused until confirmed.'
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;
}
