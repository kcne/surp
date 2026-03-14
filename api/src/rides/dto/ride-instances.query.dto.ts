import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ListRideInstancesQueryDto {
  @ApiProperty({ example: '2026-03-30' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({
    required: false,
    example: 0,
    minimum: -840,
    maximum: 840,
    description:
      'Timezone offset in minutes, where west of UTC is negative and east of UTC is positive.'
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  timezoneOffsetMinutes?: number;
}
