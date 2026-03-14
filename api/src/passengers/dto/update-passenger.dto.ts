import { ApiPropertyOptional } from '@nestjs/swagger';
import { PassengerType } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class UpdatePassengerDto {
  @ApiPropertyOptional({ example: 'Mila' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Markovic' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ example: '+381640000111' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'mila.markovic@demo.local' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ enum: PassengerType })
  @IsOptional()
  @IsEnum(PassengerType)
  passengerType?: PassengerType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'VIP customer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
