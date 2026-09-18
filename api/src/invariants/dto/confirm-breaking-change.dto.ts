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
}
