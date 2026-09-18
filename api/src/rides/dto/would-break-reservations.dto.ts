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

  @ApiProperty({
    example: 8,
    description: 'New invariant violations the proposed change would introduce.'
  })
  affectedCount!: number;

  @ApiProperty({
    example: 'Ova izmena cini 8 rezervacija nevidljivim.'
  })
  message!: string;
}
