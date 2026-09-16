import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString } from 'class-validator';
import { ReservationResponseDto } from './reservation.response.dto';

export class CancellationPreviewDto {
  @ApiProperty({ type: [String], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  reservationIds!: string[];

  @ApiProperty({ enum: ['selected', 'groups'] })
  @IsIn(['selected', 'groups'])
  scope!: 'selected' | 'groups';
}

export class CancellationPreviewResponseDto {
  @ApiProperty({ type: [ReservationResponseDto] })
  @Type(() => ReservationResponseDto)
  outboundReservations!: ReservationResponseDto[];

  @ApiProperty({ type: [ReservationResponseDto] })
  @Type(() => ReservationResponseDto)
  returnReservations!: ReservationResponseDto[];
}
