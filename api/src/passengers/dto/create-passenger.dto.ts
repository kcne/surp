import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PassengerType } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreatePassengerDto {
  @ApiProperty({ example: 'Mila' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Markovic' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: '+381640000111' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: 'mila.markovic@demo.local' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ enum: PassengerType, default: PassengerType.ADULT })
  @IsOptional()
  @IsEnum(PassengerType)
  passengerType?: PassengerType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'VIP customer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
