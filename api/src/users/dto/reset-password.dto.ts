import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'strong-new-password-123',
    description: 'New password for the target user. Minimum 8 characters.'
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'When true, blocks normal login until user updates password via policy flow.'
  })
  @IsOptional()
  @IsBoolean()
  requirePasswordChange?: boolean;
}