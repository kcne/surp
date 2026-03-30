import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RideStationTimeInputDto {
  @ApiProperty({ example: 'station-intermediate-id' })
  @IsString()
  @IsNotEmpty()
  stationId!: string;

  @ApiProperty({ example: 2, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @ApiProperty({ example: '08:30', required: false })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'time must be in HH:mm format' })
  time?: string;
}

export class RideDayScheduleInputDto {
  @ApiProperty({ example: 1, minimum: 0, maximum: 6, description: '0=Sunday ... 6=Saturday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ type: [RideStationTimeInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RideStationTimeInputDto)
  stationTimes!: RideStationTimeInputDto[];
}

export class ReplaceRideDaySchedulesDto {
  @ApiProperty({ type: [RideDayScheduleInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RideDayScheduleInputDto)
  daySchedules!: RideDayScheduleInputDto[];
}
