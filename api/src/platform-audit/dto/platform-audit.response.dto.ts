import { ApiProperty } from '@nestjs/swagger';

export class PlatformAuditEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  actorUserId!: string;

  @ApiProperty({ nullable: true })
  actorDisplayName!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  targetType!: string;

  @ApiProperty()
  targetId!: string;

  @ApiProperty({ nullable: true })
  targetDisplayName!: string | null;

  @ApiProperty({ nullable: true })
  targetTenantId!: string | null;

  @ApiProperty({ nullable: true })
  targetTenantDisplayName!: string | null;

  @ApiProperty({ nullable: true })
  targetLeadId!: string | null;

  @ApiProperty({ nullable: true })
  targetLeadDisplayName!: string | null;

  @ApiProperty({ nullable: true })
  targetUserId!: string | null;

  @ApiProperty({ nullable: true })
  targetUserDisplayName!: string | null;

  @ApiProperty({ nullable: true, type: Object })
  metadata!: unknown | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaginatedPlatformAuditResponseDto {
  @ApiProperty({ type: [PlatformAuditEventResponseDto] })
  items!: PlatformAuditEventResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 1 })
  total!: number;
}
