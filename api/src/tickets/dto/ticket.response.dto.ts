import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketStatus } from '@prisma/client';

export class TicketActorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  email!: string;
}

export class TicketAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  ticketId!: string;

  @ApiProperty({ nullable: true })
  commentId!: string | null;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty()
  storageKey!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TicketCommentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  ticketId!: string;

  @ApiProperty()
  authorUserId!: string;

  @ApiProperty({ type: TicketActorResponseDto, nullable: true })
  author!: TicketActorResponseDto | null;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: [TicketAttachmentResponseDto] })
  attachments!: TicketAttachmentResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TicketResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ nullable: true })
  createdById!: string | null;

  @ApiProperty({ type: TicketActorResponseDto, nullable: true })
  createdBy!: TicketActorResponseDto | null;

  @ApiProperty({ nullable: true })
  updatedById!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketCategory })
  category!: TicketCategory;

  @ApiProperty({ type: [TicketAttachmentResponseDto] })
  attachments!: TicketAttachmentResponseDto[];

  @ApiProperty({ type: [TicketCommentResponseDto] })
  comments!: TicketCommentResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedTicketsResponseDto {
  @ApiProperty({ type: [TicketResponseDto] })
  items!: TicketResponseDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  total!: number;
}
