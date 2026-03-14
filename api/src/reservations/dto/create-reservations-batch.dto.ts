import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class CreateReservationsBatchDto {
  @ApiProperty({ type: [CreateReservationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateReservationDto)
  items!: CreateReservationDto[];
}
