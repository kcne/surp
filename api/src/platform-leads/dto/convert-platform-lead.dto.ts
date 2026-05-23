import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConvertPlatformLeadDto {
  @ApiProperty({ example: 'drina-bus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  tenantSlug!: string;

  @ApiProperty({ example: 'Drina Bus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tenantName!: string;

  @ApiPropertyOptional({ example: 'Europe/Belgrade' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @ApiProperty({ example: 'drina-admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  adminUsername!: string;

  @ApiProperty({ example: 'admin@drina.rs' })
  @IsEmail()
  @MaxLength(120)
  adminEmail!: string;

  @ApiProperty({ example: 'strong-password-123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  adminPassword!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  requirePasswordChange?: boolean;
}
