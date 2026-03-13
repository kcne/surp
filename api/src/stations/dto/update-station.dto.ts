import { ApiPropertyOptional } from '@nestjs/swagger';
import { StationCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class UpdateStationDto {
  @ApiPropertyOptional({ example: 'Central Station - West Gate' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '10 West Street, Demo City' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @ApiPropertyOptional({ enum: StationCategory })
  @IsOptional()
  @IsEnum(StationCategory)
  category?: StationCategory;

  @ApiPropertyOptional({ example: '+1-555-0109' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Updated boarding area information.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
