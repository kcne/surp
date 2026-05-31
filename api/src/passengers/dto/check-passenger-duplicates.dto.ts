import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PassengerResponseDto } from './passenger.response.dto';

export class CheckPassengerDuplicatesDto {
  @ApiProperty({ example: 'Mila' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Marković' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: '+381640000111' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;
}

export class PassengerDuplicatesResponseDto {
  @ApiProperty({ type: [PassengerResponseDto] })
  matches!: PassengerResponseDto[];
}
