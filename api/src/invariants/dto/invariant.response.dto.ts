import { ApiProperty } from '@nestjs/swagger';

export class InvariantViolationDto {
  @ApiProperty({ example: 'reservation' })
  subjectType!: string;

  @ApiProperty({ example: 'reservation-id-123' })
  subjectId!: string;

  @ApiProperty({ example: 'Marko Markovic, 2026-09-15, polazak 07:45 vise ne postoji.' })
  summary!: string;

  @ApiProperty({
    type: Object,
    description: 'Check-specific fields backing the detail row in Settings.'
  })
  detail!: Record<string, unknown>;

  @ApiProperty({ example: true })
  canRepair!: boolean;
}

export class InvariantResultDto {
  @ApiProperty({ example: 'reservation.reachable' })
  key!: string;

  @ApiProperty({ example: 'Rezervacija se vidi na svom polasku' })
  title!: string;

  @ApiProperty({ example: 'Rezervacija se vezuje za polazak preko vremena polaska...' })
  description!: string;

  @ApiProperty({ enum: ['critical', 'warning'], example: 'critical' })
  severity!: string;

  @ApiProperty({
    example: 201,
    description: 'How much was examined. Distinguishes a clean check from one that scanned nothing.'
  })
  scannedCount!: number;

  @ApiProperty({ example: 93 })
  violationCount!: number;

  @ApiProperty({ example: 93, description: 'Violations this check could repair without guessing.' })
  repairableCount!: number;

  @ApiProperty({ example: true, description: 'Whether this check offers a repair at all.' })
  hasRepair!: boolean;

  @ApiProperty({ type: [InvariantViolationDto] })
  violations!: InvariantViolationDto[];
}

export class InvariantReportDto {
  @ApiProperty({ example: '2026-09-11T01:40:55.000Z' })
  checkedAt!: string;

  @ApiProperty({ example: 30, description: 'Days ahead the time-windowed checks covered.' })
  windowDays!: number;

  @ApiProperty({ example: 4 })
  invariantCount!: number;

  @ApiProperty({ example: 1, description: 'Invariants reporting at least one violation.' })
  violatedCount!: number;

  @ApiProperty({ example: 93 })
  totalViolationCount!: number;

  @ApiProperty({ type: [InvariantResultDto] })
  results!: InvariantResultDto[];
}

export class InvariantRepairResultDto {
  @ApiProperty({ example: 'reservation.reachable' })
  key!: string;

  @ApiProperty({ example: 93 })
  repairedCount!: number;

  @ApiProperty({
    example: 0,
    description: 'Violations the repair declined to guess at; these stay reported.'
  })
  skippedCount!: number;

  @ApiProperty({
    type: InvariantResultDto,
    description: 'The check re-run after repairing, so the caller sees what is left.'
  })
  remaining!: InvariantResultDto;
}
