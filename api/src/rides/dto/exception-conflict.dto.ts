import { ApiProperty } from '@nestjs/swagger';

/**
 * The other 409 `POST /rides/:id/exceptions` can return.
 *
 * An exception that already exists, or one that would mix a SKIP and an
 * ADDITIONAL on the same date, is refused with Nest's standard error body —
 * no `code`, and nothing to confirm. Documenting it alongside
 * `WouldBreakReservationsDto` is what lets a client tell the two apart before
 * it offers the agency a confirmation button that cannot work.
 */
export class RideExceptionConflictDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'Skip exception for this date already exists' })
  message!: string;

  @ApiProperty({ example: 'Conflict' })
  error!: string;
}
