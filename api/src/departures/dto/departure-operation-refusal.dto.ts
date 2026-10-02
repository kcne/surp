import { ApiProperty } from '@nestjs/swagger';

/** A state refusal cannot be overridden with a confirmation token. */
export class DepartureOperationRefusalDto {
  @ApiProperty({
    enum: [
      'DEPARTURE_LEGACY',
      'DEPARTURE_ALREADY_CANCELLED',
      'DEPARTURE_NOT_CANCELLED',
      'DEPARTURE_NOT_EXTRA',
      'DEPARTURE_HAS_RESERVATIONS'
    ]
  })
  code!: string;

  @ApiProperty({ example: 'Polazak je vec otkazan.' })
  message!: string;
}
