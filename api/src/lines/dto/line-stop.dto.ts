import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';

export class LineStopInputDto {
  @ApiProperty({ example: 'station-intermediate-id' })
  @IsString()
  @IsNotEmpty()
  stationId!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderIndex!: number;
}

export class ReplaceLineStopsDto {
  @ApiProperty({ type: [LineStopInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineStopInputDto)
  intermediateStops!: LineStopInputDto[];
}
