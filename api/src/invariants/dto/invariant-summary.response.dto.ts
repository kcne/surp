import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvariantViolationDto } from './invariant.response.dto';

export class InvariantRunSummaryDto {
  @ApiProperty({ example: 'clx9run123' })
  id!: string;

  @ApiProperty({ enum: ['SCHEDULED', 'MANUAL'], example: 'SCHEDULED' })
  trigger!: string;

  @ApiProperty({ example: '2026-09-18T02:00:11.000Z' })
  startedAt!: string;

  @ApiPropertyOptional({
    example: '2026-09-18T02:01:44.000Z',
    description: 'When the run finished. Absent while a run is still going.'
  })
  completedAt?: string;

  @ApiProperty({ example: 30, description: 'Days ahead the time-windowed checks covered.' })
  windowDays!: number;
}

export class InvariantSummaryItemDto {
  @ApiProperty({ example: 'reservation.reachable' })
  key!: string;

  @ApiProperty({ example: 'Rezervacija se vidi na svom polasku' })
  title!: string;

  @ApiProperty({ example: 'Rezervacija se vezuje za polazak preko vremena polaska...' })
  description!: string;

  @ApiProperty({
    example: 'Popravka vraca samo rezervacije za koje tog dana postoji tacno jedan polazak...',
    description: 'What a person should do about what a repair cannot or would not fix.'
  })
  manualAdvice!: string;

  @ApiProperty({ enum: ['critical', 'warning'], example: 'critical' })
  severity!: string;

  @ApiProperty({
    example: true,
    description:
      'Whether the last stored run covered this check at all. False for a check added since that run, which reports no count rather than a clean one.'
  })
  checked!: boolean;

  @ApiProperty({ example: 201 })
  scannedCount!: number;

  @ApiProperty({ example: 93 })
  violationCount!: number;

  @ApiProperty({ example: 93 })
  repairableCount!: number;

  @ApiProperty({ example: true })
  hasRepair!: boolean;

  @ApiPropertyOptional({
    example: '2026-09-02T02:01:44.000Z',
    description:
      'Start of the unbroken run of checks in which this invariant has been failing. Absent when it is currently clean. This is the date a postmortem asks for.'
  })
  failingSince?: string;
}

export class InvariantSummaryDto {
  @ApiPropertyOptional({
    type: InvariantRunSummaryDto,
    description: 'The last completed run. Absent when no check has ever run for this tenant.'
  })
  lastRun?: InvariantRunSummaryDto;

  @ApiProperty({ example: 16, description: 'Invariants the system knows about right now.' })
  invariantCount!: number;

  @ApiProperty({ example: 1, description: 'Invariants reporting at least one violation.' })
  violatedCount!: number;

  @ApiProperty({
    example: 1,
    description: 'Violated invariants whose severity is critical. Drives the page-level state.'
  })
  criticalViolatedCount!: number;

  @ApiProperty({ example: 93 })
  totalViolationCount!: number;

  @ApiProperty({ type: [InvariantSummaryItemDto] })
  items!: InvariantSummaryItemDto[];
}

export class InvariantHistoryPointDto {
  @ApiProperty({ example: 'clx9run123' })
  runId!: string;

  @ApiProperty({ enum: ['SCHEDULED', 'MANUAL'], example: 'SCHEDULED' })
  trigger!: string;

  @ApiProperty({ example: '2026-09-18T02:01:44.000Z' })
  checkedAt!: string;

  @ApiProperty({
    example: true,
    description: 'Whether the run covered this check. A run predating the check did not.'
  })
  checked!: boolean;

  @ApiProperty({ example: 93 })
  violationCount!: number;

  @ApiProperty({ example: 201 })
  scannedCount!: number;
}

export class InvariantHistoryViolationDto extends InvariantViolationDto {
  @ApiProperty({
    example: '2026-09-02T02:01:44.000Z',
    description:
      'The earliest stored run that reported this exact violation without a clean run in between.'
  })
  firstSeenAt!: string;
}

export class InvariantDetailDto {
  @ApiProperty({ example: 'reservation.reachable' })
  key!: string;

  @ApiProperty({ example: 'Rezervacija se vidi na svom polasku' })
  title!: string;

  @ApiProperty({ example: 'Rezervacija se vezuje za polazak preko vremena polaska...' })
  description!: string;

  @ApiProperty({ example: 'Popravka vraca samo rezervacije za koje tog dana postoji...' })
  manualAdvice!: string;

  @ApiProperty({ enum: ['critical', 'warning'], example: 'critical' })
  severity!: string;

  @ApiProperty({ example: true })
  hasRepair!: boolean;

  @ApiPropertyOptional({
    type: InvariantRunSummaryDto,
    description: 'The run the violations below come from.'
  })
  lastRun?: InvariantRunSummaryDto;

  @ApiProperty({ example: 201 })
  scannedCount!: number;

  @ApiProperty({ example: 93 })
  violationCount!: number;

  @ApiProperty({ example: 93 })
  repairableCount!: number;

  @ApiProperty({
    type: [InvariantHistoryViolationDto],
    description: 'Violations as of the last run, each dated to when it first appeared.'
  })
  violations!: InvariantHistoryViolationDto[];

  @ApiProperty({
    type: [InvariantHistoryPointDto],
    description:
      'Stored runs, newest first, so a count can be read as a trend rather than a number.'
  })
  history!: InvariantHistoryPointDto[];
}
