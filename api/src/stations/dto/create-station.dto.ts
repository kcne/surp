import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StationCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateStationDto {
  @ApiProperty({ example: 'Central Station' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '1 Main Street, Demo City' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  address!: string;

  @ApiPropertyOptional({ enum: StationCategory })
  @IsOptional()
  @IsEnum(StationCategory)
  category?: StationCategory;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @ApiPropertyOptional({ example: 'Primary station near downtown terminal.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
