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
      'When true and items.length > 1, all reservations in the batch are stamped with the same server-generated groupId so they appear as one travel group in driver exports.',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  travelTogether?: boolean;
}
