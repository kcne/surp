import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from '@nestjs/common';
import { Prisma, TicketCategory, TicketStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AccessTokenPayload } from '../auth/auth.types';
import { withCreateAudit, withUpdateAudit } from '../prisma/audit-write.helper';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, resolvePagination } from '../prisma/repository-helpers';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import {
  CompleteTicketAttachmentDto,
  TicketAttachmentDownloadResponseDto,
  TicketAttachmentPresignResponseDto
} from './dto/ticket-attachment.dto';
import { ListTicketsQueryDto } from './dto/list-tickets.query.dto';
import {
  PaginatedTicketsResponseDto,
  TicketActorResponseDto,
  TicketResponseDto
} from './dto/ticket.response.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketStorageService } from './ticket-storage.service';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const SAFE_TICKET_SELECT = {
  id: true,
  tenantId: true,
  createdById: true,
  updatedById: true,
  title: true,
  description: true,
  status: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  attachments: {
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      commentId: true,
      createdById: true,
      updatedById: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      createdAt: true,
      updatedAt: true
    },
    where: {
      commentId: null
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  },
  comments: {
    select: {
      id: true,
      tenantId: true,
      ticketId: true,
      authorUserId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      attachments: {
        select: {
          id: true,
          tenantId: true,
          ticketId: true,
          commentId: true,
          createdById: true,
          updatedById: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: 'asc' as const
        }
      }
    },
    orderBy: {
      createdAt: 'asc' as const
    }
  }
} as const;

type SelectedTicket = Prisma.TicketGetPayload<{ select: typeof SAFE_TICKET_SELECT }>;

type TicketActorLookup = Map<string, TicketActorResponseDto>;

@Injectable()
export class TicketsService {
  private readonly maxImageBytes: number;
  private readonly uploadUrlTtlSeconds: number;
  private readonly downloadUrlTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly ticketStorageService: TicketStorageService
  ) {
    this.maxImageBytes = this.configService.get<number>('TICKETS_MAX_IMAGE_BYTES', 5 * 1024 * 1024);
    this.uploadUrlTtlSeconds = this.configService.get<number>('TICKETS_UPLOAD_URL_TTL_SECONDS', 600);
    this.downloadUrlTtlSeconds = this.configService.get<number>('TICKETS_DOWNLOAD_URL_TTL_SECONDS', 600);
  }

  async create(auth: AccessTokenPayload, dto: CreateTicketDto): Promise<TicketResponseDto> {
    const created = await this.prisma.ticket.create({
      data: withCreateAudit(
        {
          tenantId: auth.tenantId,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category ?? TicketCategory.QUESTION,
          status: TicketStatus.OPEN
        },
        auth.sub
      ),
      select: SAFE_TICKET_SELECT
    });

    const actorLookup = await this.buildActorLookup(auth.tenantId, [created]);
    return this.toTicketResponse(created, actorLookup);
  }

  async list(auth: AccessTokenPayload, query: ListTicketsQueryDto): Promise<PaginatedTicketsResponseDto> {
    const pagination = resolvePagination(query.page, query.pageSize);
    const term = query.search?.trim();

    const where: Prisma.TicketWhereInput = {
      tenantId: auth.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ updatedAt: 'desc' }],
        select: SAFE_TICKET_SELECT
      }),
      this.prisma.ticket.count({ where })
    ]);

    const actorLookup = await this.buildActorLookup(auth.tenantId, items);

    return {
      items: items.map((item) => this.toTicketResponse(item, actorLookup)),
      total,
      page: pagination.page ?? DEFAULT_PAGE,
      pageSize: pagination.pageSize ?? DEFAULT_PAGE_SIZE
    };
  }

  async getById(auth: AccessTokenPayload, id: string): Promise<TicketResponseDto> {
    const ticket = await this.getTicketOrThrow(auth.tenantId, id);
    const actorLookup = await this.buildActorLookup(auth.tenantId, [ticket]);
    return this.toTicketResponse(ticket, actorLookup);
  }

  async update(auth: AccessTokenPayload, id: string, dto: UpdateTicketDto): Promise<TicketResponseDto> {
    const existing = await this.getTicketOrThrow(auth.tenantId, id);

    if (dto.status) {
      this.validateStatusTransition(existing.status, dto.status);
    }

    const updated = await this.prisma.ticket.update({
      where: {
        id
      },
      data: withUpdateAudit(
        {
          ...(typeof dto.title === 'string' ? { title: dto.title.trim() } : {}),
          ...(typeof dto.description === 'string' ? { description: dto.description.trim() } : {}),
          ...(dto.category ? { category: dto.category } : {}),
          ...(dto.status ? { status: dto.status } : {})
        },
        auth.sub
      ),
      select: SAFE_TICKET_SELECT
    });

    const actorLookup = await this.buildActorLookup(auth.tenantId, [updated]);
    return this.toTicketResponse(updated, actorLookup);
  }

  async addComment(
    auth: AccessTokenPayload,
    ticketId: string,
    dto: CreateTicketCommentDto
  ): Promise<TicketResponseDto> {
    await this.getTicketOrThrow(auth.tenantId, ticketId);

    await this.prisma.$transaction(async (tx) => {
      await tx.ticketComment.create({
        data: {
          tenantId: auth.tenantId,
          ticketId,
          authorUserId: auth.sub,
          content: dto.content.trim()
        }
      });

      await tx.ticket.update({
        where: {
          id: ticketId
        },
        data: withUpdateAudit({}, auth.sub)
      });
    });

    const ticket = await this.getTicketOrThrow(auth.tenantId, ticketId);
    const actorLookup = await this.buildActorLookup(auth.tenantId, [ticket]);
    return this.toTicketResponse(ticket, actorLookup);
  }

  async presignUpload(
    auth: AccessTokenPayload,
    ticketId: string,
    fileName: string,
    mimeType: string,
    sizeBytes: number
  ): Promise<TicketAttachmentPresignResponseDto> {
    await this.getTicketOrThrow(auth.tenantId, ticketId);
    this.assertImageUploadAllowed(fileName, mimeType, sizeBytes);

    const sanitizedFileName = this.sanitizeFileName(fileName);
    const storageKey = `tenants/${auth.tenantId}/tickets/${ticketId}/${randomUUID()}-${sanitizedFileName}`;
    const uploadUrl = await this.ticketStorageService.createUploadUrl(
      storageKey,
      mimeType,
      this.uploadUrlTtlSeconds
    );

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds: this.uploadUrlTtlSeconds
    };
  }

  async completeAttachment(
    auth: AccessTokenPayload,
    ticketId: string,
    dto: CompleteTicketAttachmentDto,
    commentId?: string
  ): Promise<TicketResponseDto> {
    await this.getTicketOrThrow(auth.tenantId, ticketId);
    this.assertImageUploadAllowed(dto.fileName, dto.mimeType, dto.sizeBytes);
    this.assertStorageKeyBelongsToTicket(auth.tenantId, ticketId, dto.storageKey);

    const objectExists = await this.ticketStorageService.objectExists(dto.storageKey);
    if (!objectExists) {
      throw new BadRequestException('Uploaded file not found in bucket for provided storageKey');
    }

    if (commentId) {
      const comment = await this.prisma.ticketComment.findFirst({
        where: {
          id: commentId,
          ticketId,
          tenantId: auth.tenantId
        },
        select: {
          id: true
        }
      });

      if (!comment) {
        throw new NotFoundException('Ticket comment not found');
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.ticketAttachment.create({
          data: withCreateAudit(
            {
              tenantId: auth.tenantId,
              ticketId,
              commentId: commentId ?? null,
              fileName: dto.fileName,
              mimeType: dto.mimeType,
              sizeBytes: dto.sizeBytes,
              storageKey: dto.storageKey
            },
            auth.sub
          )
        });

        await tx.ticket.update({
          where: {
            id: ticketId
          },
          data: withUpdateAudit({}, auth.sub)
        });
      });
    } catch (error) {
      this.throwIfStorageKeyConflict(error);
      throw error;
    }

    const ticket = await this.getTicketOrThrow(auth.tenantId, ticketId);
    const actorLookup = await this.buildActorLookup(auth.tenantId, [ticket]);
    return this.toTicketResponse(ticket, actorLookup);
  }

  async getAttachmentDownloadUrl(
    auth: AccessTokenPayload,
    ticketId: string,
    attachmentId: string
  ): Promise<TicketAttachmentDownloadResponseDto> {
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: {
        id: attachmentId,
        ticketId,
        tenantId: auth.tenantId
      },
      select: {
        storageKey: true
      }
    });

    if (!attachment) {
      throw new NotFoundException('Ticket attachment not found');
    }

    const objectExists = await this.ticketStorageService.objectExists(attachment.storageKey);
    if (!objectExists) {
      throw new InternalServerErrorException('Attachment object is missing in bucket storage');
    }

    const downloadUrl = await this.ticketStorageService.createDownloadUrl(
      attachment.storageKey,
      this.downloadUrlTtlSeconds
    );

    return {
      downloadUrl,
      expiresInSeconds: this.downloadUrlTtlSeconds
    };
  }

  private async getTicketOrThrow(tenantId: string, id: string): Promise<SelectedTicket> {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id,
        tenantId
      },
      select: SAFE_TICKET_SELECT
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  private validateStatusTransition(_current: TicketStatus, next: TicketStatus): void {
    if (!Object.values(TicketStatus).includes(next)) {
      throw new BadRequestException(`Invalid ticket status value: ${next}`);
    }
  }

  private assertImageUploadAllowed(fileName: string, mimeType: string, sizeBytes: number): void {
    if (!fileName.trim()) {
      throw new BadRequestException('fileName is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported image type');
    }

    if (sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be greater than zero');
    }

    if (sizeBytes > this.maxImageBytes) {
      throw new BadRequestException(`Image exceeds maximum allowed size of ${this.maxImageBytes} bytes`);
    }
  }

  private sanitizeFileName(fileName: string): string {
    const normalized = fileName.trim().toLowerCase();
    const sanitized = normalized.replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
    return sanitized.slice(0, 120) || 'image';
  }

  private assertStorageKeyBelongsToTicket(tenantId: string, ticketId: string, storageKey: string): void {
    if (storageKey.includes('..')) {
      throw new BadRequestException('storageKey contains invalid path traversal segments');
    }

    const expectedPrefix = `tenants/${tenantId}/tickets/${ticketId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException('storageKey does not belong to the current tenant ticket context');
    }
  }

  private throwIfStorageKeyConflict(error: unknown): void {
    const prismaError = error as {
      code?: string;
      meta?: {
        target?: string[];
      };
    };

    if (prismaError?.code !== 'P2002') {
      return;
    }

    const targets = prismaError.meta?.target ?? [];
    if (targets.includes('storageKey') || targets.includes('TicketAttachment_storageKey_key')) {
      throw new ConflictException('Attachment storage key already exists');
    }

    throw new ConflictException('Ticket attachment unique constraint violated');
  }

  private async buildActorLookup(tenantId: string, tickets: SelectedTicket[]): Promise<TicketActorLookup> {
    const actorIds = new Set<string>();

    for (const ticket of tickets) {
      if (ticket.createdById) {
        actorIds.add(ticket.createdById);
      }

      for (const comment of ticket.comments) {
        actorIds.add(comment.authorUserId);
      }
    }

    if (actorIds.size === 0) {
      return new Map();
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        id: {
          in: [...actorIds]
        }
      },
      select: {
        id: true,
        username: true,
        email: true
      }
    });

    return new Map(users.map((user) => [user.id, this.toActor(user)]));
  }

  private toTicketResponse(ticket: SelectedTicket, actorLookup: TicketActorLookup): TicketResponseDto {
    return {
      ...ticket,
      createdBy: ticket.createdById ? actorLookup.get(ticket.createdById) ?? null : null,
      attachments: ticket.attachments.map((attachment) => ({ ...attachment })),
      comments: ticket.comments.map((comment) => ({
        ...comment,
        author: actorLookup.get(comment.authorUserId) ?? null,
        attachments: comment.attachments.map((attachment) => ({ ...attachment }))
      }))
    };
  }

  private toActor(actor: { id: string; username: string; email: string }): TicketActorResponseDto {
    return {
      id: actor.id,
      displayName: actor.username,
      email: actor.email
    };
  }
}
