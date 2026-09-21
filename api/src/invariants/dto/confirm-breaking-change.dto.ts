import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ConfirmBreakingChangeDto {
  @ApiPropertyOptional({
    example: false,
    description:
      'Allows unresolved violations. May be combined with repairBreakingChange when separate invariants need separate answers.'
  })
  @IsOptional()
  @IsBoolean()
  confirmBreakingChange?: boolean;

  /**
   * The repair answer to a refusal.
   *
   * `confirmBreakingChange` means "write it and leave the breakage for someone
   * to find in the integrity report". This one means "write it and put the
   * affected reservations back in order", and it is only an answer the client
   * should offer when the refusal said `repairable`. Both may be set when one
   * write raises separate invariant questions. An attempted repair that fails
   * refuses the write even when confirmation is also set.
   */
  @ApiPropertyOptional({
    example: false,
    description:
      'Applies the change and repairs affected reservations. A failed repair refuses the whole write even when confirmBreakingChange is also true.'
  })
  @IsOptional()
  @IsBoolean()
  repairBreakingChange?: boolean;
}
