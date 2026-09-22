import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class CreateReservationsBatchDto {
  @ApiProperty({ type: [CreateReservationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateReservationDto)
  items!: CreateReservationDto[];

  @ApiPropertyOptional({
    description:
      'When true, all reservations in the batch must use the same ride, travel date, and departure time and share one server-generated groupId. When false or omitted, each distinct passenger receives an individual groupId.',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  travelTogether?: boolean;
}
