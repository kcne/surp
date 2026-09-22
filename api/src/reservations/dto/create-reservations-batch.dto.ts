import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

export class CreateReservationBatchItemDto extends CreateReservationDto {
  @ApiPropertyOptional({
    description: 'Zero-based index of an earlier outbound item in this batch. Cannot be combined with returnOfReservationId.',
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  returnOfIndex?: number;
}

export class CreateReservationsBatchDto {
  @ApiProperty({ type: [CreateReservationBatchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateReservationBatchItemDto)
  items!: CreateReservationBatchItemDto[];

  @ApiPropertyOptional({
    description:
      'When true, reservations on each departure share one server-generated groupId. When false or omitted, each distinct passenger on each departure receives an individual groupId.',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  travelTogether?: boolean;
}
