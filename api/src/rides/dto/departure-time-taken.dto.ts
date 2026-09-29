import { ApiProperty } from '@nestjs/swagger';

/**
 * The 409 for a write that would leave two departures of one ride on one date
 * at the same departure time (#27, PR 3a). Until PR 4 a booking names its bus
 * by that time, so such a pair would make both unbookable. Nothing to confirm:
 * the time has to change.
 */
export class DepartureTimeTakenDto {
  @ApiProperty({ enum: ['DEPARTURE_TIME_TAKEN'], example: 'DEPARTURE_TIME_TAKEN' })
  code!: 'DEPARTURE_TIME_TAKEN';

  @ApiProperty({
    example:
      'Voznja na liniji Beograd - Nis 2026-10-05 vec ima polazak u 09:00. Dva polaska iste voznje istog dana ne mogu da krecu u isto vreme.'
  })
  message!: string;
}
