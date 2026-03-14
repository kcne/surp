import { ApiPropertyOptional } from '@nestjs/swagger';
import { LineDirection, LineDirectionMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class ListLinesQueryDto {
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: LineDirectionMode })
  @IsOptional()
  @IsEnum(LineDirectionMode)
  directionMode?: LineDirectionMode;

  @ApiPropertyOptional({ enum: LineDirection })
  @IsOptional()
  @IsEnum(LineDirection)
  direction?: LineDirection;

  @ApiPropertyOptional({ example: 'central' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
