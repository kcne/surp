import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePlatformTenantAdminDto {
  @ApiProperty({ example: 'balbus-admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'admin@balbus.rs' })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'strong-password-123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'When true, admin must change password before normal login.'
  })
  @IsOptional()
  @IsBoolean()
  requirePasswordChange?: boolean;
}