import { ApiProperty } from '@nestjs/swagger';

/**
 * The body of the 409 a write returns when it would leave the data in a state
 * one of the invariants calls broken.
 *
 * It carries the count rather than a sentence alone, so the client can ask the
 * question with a number in it: "this leaves 8 passengers on a seat that no
 * longer exists" is a decision an agency can make, "the update failed" is not.
 * Resending the same request with `confirmBreakingChange: true` goes through.
 */
export class WouldBreakReservationsDto {
  @ApiProperty({ example: 'WOULD_BREAK_RESERVATIONS' })
  code!: string;

  @ApiProperty({
    example: 'reservation.seatWithinCapacity',
    description: 'Key of the invariant the change would violate.'
  })
  invariant!: string;

  @ApiProperty({ example: 8, description: 'Reservations the change would break.' })
  affectedCount!: number;

  @ApiProperty({
    example: 38,
    description: 'Highest seat number still sold, so the caller can see the floor.'
  })
  highestOccupiedSeat!: number;

  @ApiProperty({
    example:
      'Smanjenje kapaciteta na 30 ostavlja 8 rezervacija na sedistu koje vise ne postoji; najvise zauzeto sediste je 38.'
  })
  message!: string;
}
