import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'demo-admin',
    description: 'Username or email used to authenticate.'
  })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'demo-admin-pass' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
