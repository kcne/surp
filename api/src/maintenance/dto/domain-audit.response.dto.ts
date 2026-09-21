import { ApiProperty } from '@nestjs/swagger';

export class DomainAuditEventResponseDto {
  @ApiProperty({ example: 'clx9user123' })
  actorUserId!: string;

  @ApiProperty({ enum: ['create', 'update', 'delete'], example: 'update' })
  action!: 'create' | 'update' | 'delete';

  @ApiProperty({ example: { stationId: { before: 'old', after: 'new' } } })
  changes!: Record<string, unknown>;

  @ApiProperty({ example: '2026-09-21T08:15:00.000Z' })
  createdAt!: string;
}
