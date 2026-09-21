import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmBreakingChangeDto {
  @ApiPropertyOptional({
    example: false,
    description: 'Confirms a change previously refused with WOULD_BREAK_RESERVATIONS.'
  })
  @IsOptional()
  @IsBoolean()
  confirmBreakingChange?: boolean;

  /**
   * The other answer to the same question.
   *
   * `confirmBreakingChange` means "write it and leave the breakage for someone
   * to find in the integrity report". This one means "write it and put the
   * affected reservations back in order", and it is only an answer the client
   * should offer when the refusal said `repairable`. Where no repair exists —
   * most of them, because most fixes are a routing decision or a telephone
   * call — the write is refused exactly as it would have been, rather than
   * going through on a promise nothing kept.
   */
  @ApiPropertyOptional({
    example: false,
    description:
      'Applies the change and repairs the reservations it would break. Refused as before when the violation has no repair, so it never stands in for confirmBreakingChange.'
  })
  @IsOptional()
  @IsBoolean()
  repairBreakingChange?: boolean;
}
