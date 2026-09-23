import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RideExceptionType } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ConfirmBreakingChangeDto } from '../../invariants/dto/confirm-breaking-change.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateRideExceptionDto extends ConfirmBreakingChangeDto {
  @ApiProperty({ example: '2026-03-20' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: RideExceptionType, example: RideExceptionType.SKIP })
  @IsEnum(RideExceptionType)
  type!: RideExceptionType;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime?: string;

  @ApiPropertyOptional({ example: '10:30' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'arrivalTime must be in HH:mm format' })
  arrivalTime?: string;
}

/**
 * New times for an ADDITIONAL exception. The date and type are not editable:
 * a departure on another date, or a SKIP, is a different exception.
 */
export class UpdateRideExceptionDto extends ConfirmBreakingChangeDto {
  @ApiProperty({ example: '09:15' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiProperty({ example: '10:45' })
  @IsString()
  @Matches(TIME_PATTERN, { message: 'arrivalTime must be in HH:mm format' })
  arrivalTime!: string;
}
