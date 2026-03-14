import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReservationResponseDto } from './reservation.response.dto';

export class ReservationBatchItemErrorDto {
  @ApiProperty()
  code!: number;

  @ApiProperty()
  message!: string;
}

export class ReservationBatchItemResultDto {
  @ApiProperty({ minimum: 0 })
  index!: number;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional({ type: ReservationResponseDto })
  reservation?: ReservationResponseDto;

  @ApiPropertyOptional({ type: ReservationBatchItemErrorDto })
  error?: ReservationBatchItemErrorDto;
}

export class BatchReservationsResponseDto {
  @ApiProperty({ minimum: 1 })
  totalRequested!: number;

  @ApiProperty({ minimum: 0 })
  createdCount!: number;

  @ApiProperty({ minimum: 0 })
  failedCount!: number;

  @ApiProperty({ type: [ReservationBatchItemResultDto] })
  items!: ReservationBatchItemResultDto[];
}
