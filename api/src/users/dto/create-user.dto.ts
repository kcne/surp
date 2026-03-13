import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'ops-manager' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'ops.manager@demo.local' })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: 'strong-password-123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: [UserRole.MANAGER, UserRole.STAFF] })
  @IsEnum(UserRole)
  role!: UserRole;
}
