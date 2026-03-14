import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RideDayTimeInputDto {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0=Sunday ... 6=Saturday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '08:30' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'departureTime must be in HH:mm format' })
  departureTime!: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'arrivalTime must be in HH:mm format' })
  arrivalTime!: string;
}

export class ReplaceRideDayTimesDto {
  @ApiProperty({ type: [RideDayTimeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RideDayTimeInputDto)
  dayTimes!: RideDayTimeInputDto[];
}
