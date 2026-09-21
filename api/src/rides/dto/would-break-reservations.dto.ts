import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The body of the 409 a write returns when it would leave the data in a state
 * one of the invariants calls broken.
 *
 * It carries the count rather than a sentence alone, so the client can ask the
 * question with a number in it: "this leaves 8 passengers on a seat that no
 * longer exists" is a decision an agency can make, "the update failed" is not.
 * Resending the same request with `confirmBreakingChange: true` goes through
 * and leaves the breakage behind; `repairBreakingChange: true` goes through and
 * repairs it, but only where `repairable` says there is a repair to run.
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

  /**
   * True only when a repair exists for this invariant *and* it would settle
   * every one of the affected subjects. Partial repair is not offered: an
   * agency told "this fixes it" and then left with three broken reservations
   * is worse off than one told plainly that nothing can be fixed automatically.
   */
  @ApiProperty({
    example: true,
    description:
      'Whether resending with repairBreakingChange would settle every affected subject rather than leaving it broken.'
  })
  repairable!: boolean;

  @ApiPropertyOptional({
    example: 'Premesta 8 rezervacija na novo vreme polaska i slobodna mesta.',
    description: 'What the repair would do, in Serbian. Present when repairable.'
  })
  repairMessage?: string;
}
