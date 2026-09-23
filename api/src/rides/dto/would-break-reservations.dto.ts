import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The body of the 409 a write returns when it would leave the data in a state
 * one of the invariants calls broken.
 *
 * It carries the count rather than a sentence alone, so the client can ask the
 * question with a number in it: "this leaves 8 passengers on a seat that no
 * longer exists" is a decision an agency can make, "the update failed" is not.
 * Resending the same request with `confirmationToken` in `confirmationTokens`
 * goes through and leaves the breakage behind; in `repairTokens` it goes through
 * and repairs it, but only where `repairable` says there is a repair to run.
 * Either answer holds only while the affected set is the one described here.
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

  @ApiProperty({
    example: '9f2c5c0e6a1d4b7f8e3a2c1b0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e',
    description:
      'Identifies the affected set described here. Send it back in confirmationTokens or repairTokens to answer this refusal. If the set changes before the answer arrives, the write is refused again with a new token.'
  })
  confirmationToken!: string;

  /**
   * True only when a repair exists for this invariant *and* it would settle
   * every one of the affected subjects. Partial repair is not offered: an
   * agency told "this fixes it" and then left with three broken reservations
   * is worse off than one told plainly that nothing can be fixed automatically.
   */
  @ApiProperty({
    example: true,
    description:
      'Whether resending with confirmationToken in repairTokens would settle every affected subject rather than leaving it broken.'
  })
  repairable!: boolean;

  @ApiPropertyOptional({
    example: 'Premesta 8 rezervacija na novo vreme polaska i slobodna mesta.',
    description: 'What the repair would do, in Serbian. Present when repairable.'
  })
  repairMessage?: string;
}
