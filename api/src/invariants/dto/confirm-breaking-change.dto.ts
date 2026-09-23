import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ProspectiveWriteConsent } from '../prospective-write';

export class ConfirmBreakingChangeDto {
  /**
   * The "save anyway" answer to a refusal.
   *
   * Each entry is the `confirmationToken` of a refusal the operator was shown.
   * It permits exactly the violations that refusal listed: if a booking landed
   * in between and changed them, the write is refused again with a new token,
   * so the count confirmed is always the count written.
   */
  @ApiPropertyOptional({
    type: [String],
    example: ['9f2c5c0e6a1d4b7f8e3a2c1b0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e'],
    description:
      'confirmationToken values from WOULD_BREAK_RESERVATIONS refusals the operator chose to save anyway. Permits exactly the violations each refusal listed.'
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  confirmationTokens?: string[];

  /**
   * The "save and repair" answer to a refusal. Only an answer the client
   * should offer when the refusal said `repairable`. A requested repair that
   * fails refuses the whole write, even when another refusal was confirmed.
   */
  @ApiPropertyOptional({
    type: [String],
    example: [],
    description:
      'confirmationToken values from repairable WOULD_BREAK_RESERVATIONS refusals the operator chose to repair. A failed repair refuses the whole write.'
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  repairTokens?: string[];

  /**
   * Still accepted so a tab loaded before tokens existed gets a readable
   * refusal rather than a validation error — but it permits nothing. An answer
   * that names no refusal cannot say what it agreed to, and a page that sends
   * it cannot send a token either, so the refusal tells the operator to reload.
   */
  @ApiPropertyOptional({
    deprecated: true,
    example: false,
    description: 'Permits nothing. A refusal to a request carrying it tells the operator to reload the page. Send confirmationTokens instead.'
  })
  @IsOptional()
  @IsBoolean()
  confirmBreakingChange?: boolean;

  @ApiPropertyOptional({
    deprecated: true,
    example: false,
    description: 'Ignored. Send repairTokens instead.'
  })
  @IsOptional()
  @IsBoolean()
  repairBreakingChange?: boolean;
}

export function consentFrom(dto: ConfirmBreakingChangeDto): ProspectiveWriteConsent {
  const confirmationTokens = dto.confirmationTokens ?? [];
  const repairTokens = dto.repairTokens ?? [];

  return {
    confirmationTokens,
    repairTokens,
    fromStaleClient:
      confirmationTokens.length === 0 &&
      repairTokens.length === 0 &&
      (dto.confirmBreakingChange === true || dto.repairBreakingChange === true)
  };
}
