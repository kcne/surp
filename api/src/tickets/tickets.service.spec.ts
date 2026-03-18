import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketCategory, TicketStatus, UserRole } from '@prisma/client';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  const auth = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    role: UserRole.ADMIN,
    username: 'admin-user'
  };

  const ticketRecord = {
    id: 'ticket-1',
    tenantId: 'tenant-1',
    createdById: 'user-1',
    updatedById: 'user-1',
    title: 'Login fails',
    description: 'Cannot login on Safari.',
    status: TicketStatus.OPEN,
    category: TicketCategory.BUG,
    createdAt: new Date('2026-03-18T10:00:00.000Z'),
    updatedAt: new Date('2026-03-18T10:00:00.000Z'),
    attachments: [],
    comments: []
  };

  const userRecord = {
    id: 'user-1',
    username: 'admin-user',
    email: 'admin@demo.local'
  };

  const prismaMock = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    ticketComment: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    ticketAttachment: {
      findFirst: jest.fn(),
      create: jest.fn()
    },
    user: {
      findMany: jest.fn()
    },
    $transaction: jest.fn()
  };

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: number) => {
      if (key === 'TICKETS_MAX_IMAGE_BYTES') {
        return 5 * 1024 * 1024;
      }
      if (key === 'TICKETS_UPLOAD_URL_TTL_SECONDS') {
        return 600;
      }
      if (key === 'TICKETS_DOWNLOAD_URL_TTL_SECONDS') {
        return 600;
      }
      return fallback;
    })
  };

  const storageServiceMock = {
    createUploadUrl: jest.fn().mockResolvedValue('https://example.com/upload'),
    createDownloadUrl: jest.fn().mockResolvedValue('https://example.com/download'),
    objectExists: jest.fn().mockResolvedValue(true)
  };

  let service: TicketsService;

  beforeEach(() => {
    jest.clearAllMocks();

    prismaMock.ticket.create.mockResolvedValue(ticketRecord);
    prismaMock.ticket.findFirst.mockResolvedValue(ticketRecord);
    prismaMock.ticket.findMany.mockResolvedValue([ticketRecord]);
    prismaMock.ticket.count.mockResolvedValue(1);
    prismaMock.ticket.update.mockResolvedValue({ ...ticketRecord, status: TicketStatus.IN_PROGRESS });
    prismaMock.ticketAttachment.findFirst.mockResolvedValue({ storageKey: 'tenants/tenant-1/tickets/ticket-1/key' });
    prismaMock.user.findMany.mockResolvedValue([userRecord]);
    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }

      return Promise.all(input as Promise<unknown>[]);
    });

    service = new TicketsService(
      prismaMock as never,
      configServiceMock as never,
      storageServiceMock as never
    );
  });

  it('creates tenant-scoped ticket with trimmed fields', async () => {
    const created = await service.create(auth, {
      title: '  Login fails  ',
      description: '  Cannot login on Safari.  ',
      category: TicketCategory.BUG
    });

    expect(prismaMock.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: auth.tenantId,
          title: 'Login fails',
          description: 'Cannot login on Safari.'
        })
      })
    );
    expect(created.tenantId).toBe(auth.tenantId);
  });

  it('allows status updates between any defined statuses', async () => {
    prismaMock.ticket.findFirst.mockResolvedValueOnce({
      ...ticketRecord,
      status: TicketStatus.CLOSED
    });

    await expect(
      service.update(auth, 'ticket-1', {
        status: TicketStatus.IN_PROGRESS
      })
    ).resolves.toBeTruthy();
  });

  it('rejects attachment completion when storage key is outside tenant ticket scope', async () => {
    await expect(
      service.completeAttachment(auth, 'ticket-1', {
        storageKey: 'tenants/tenant-2/tickets/ticket-1/key',
        fileName: 'test.png',
        mimeType: 'image/png',
        sizeBytes: 12345
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found when reading ticket from another tenant', async () => {
    prismaMock.ticket.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getById(
        {
          ...auth,
          tenantId: 'tenant-2'
        },
        'ticket-1'
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
