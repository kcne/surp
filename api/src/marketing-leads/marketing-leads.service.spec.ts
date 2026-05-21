import { MarketingLeadDeparturesPerDay, MarketingLeadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingLeadsEmailService } from './marketing-leads-email.service';
import { MarketingLeadsService } from './marketing-leads.service';

describe('MarketingLeadsService', () => {
  const emailServiceMock = {
    sendLeadNotification: jest.fn()
  };
  const prismaMock = {
    marketingLead: {
      create: jest.fn(),
      update: jest.fn()
    }
  };

  let service: MarketingLeadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    emailServiceMock.sendLeadNotification.mockResolvedValue({
      internalEmailSent: true,
      confirmationEmailSent: true
    });
    prismaMock.marketingLead.create.mockResolvedValue({
      id: 'clwm0k6q40000s60m5zg7n3c2',
      status: MarketingLeadStatus.NEW
    });
    prismaMock.marketingLead.update.mockResolvedValue({});
    service = new MarketingLeadsService(
      emailServiceMock as unknown as MarketingLeadsEmailService,
      prismaMock as unknown as PrismaService
    );
  });

  it('persists a valid lead before sending email and returns the database id', async () => {
    const dto = {
      name: 'Petar Petrovic',
      email: 'petar@example.com',
      agencyName: 'Drina Bus',
      phone: '+381 64 123 4567',
      departuresPerDay: '6-20' as const,
      message: 'Zelimo online rezervacije.'
    };

    const result = await service.createLead(dto, '127.0.0.1');

    expect(result.id).toBe('clwm0k6q40000s60m5zg7n3c2');
    expect(result.message).toBe('Marketing lead received.');
    expect(prismaMock.marketingLead.create).toHaveBeenCalledWith({
      data: {
        name: 'Petar Petrovic',
        email: 'petar@example.com',
        agencyName: 'Drina Bus',
        phone: '+381 64 123 4567',
        departuresPerDay: MarketingLeadDeparturesPerDay.SIX_TO_TWENTY,
        message: 'Zelimo online rezervacije.',
        ipAddress: '127.0.0.1'
      },
      select: {
        id: true,
        status: true
      }
    });
    expect(emailServiceMock.sendLeadNotification).toHaveBeenCalledWith(
      'clwm0k6q40000s60m5zg7n3c2',
      dto,
      '127.0.0.1'
    );
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith({
      where: { id: 'clwm0k6q40000s60m5zg7n3c2' },
      data: {
        internalEmailSentAt: expect.any(Date),
        confirmationEmailSentAt: expect.any(Date),
        lastEmailError: null
      }
    });
  });

  it('updates only internal email timestamp when confirmation email fails', async () => {
    emailServiceMock.sendLeadNotification.mockResolvedValue({
      internalEmailSent: true,
      confirmationEmailSent: false,
      errorMessage: 'Confirmation failed'
    });

    await service.createLead(
      {
        name: 'Petar Petrovic',
        email: 'petar@example.com',
        agencyName: 'Drina Bus',
        departuresPerDay: '21-50'
      },
      undefined
    );

    expect(prismaMock.marketingLead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departuresPerDay: MarketingLeadDeparturesPerDay.TWENTY_ONE_TO_FIFTY
        })
      })
    );
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith({
      where: { id: 'clwm0k6q40000s60m5zg7n3c2' },
      data: {
        internalEmailSentAt: expect.any(Date),
        confirmationEmailSentAt: undefined,
        lastEmailError: 'Confirmation failed'
      }
    });
  });

  it('stores email errors and still returns success after database persistence', async () => {
    emailServiceMock.sendLeadNotification.mockRejectedValue(new Error('Email provider unavailable'));

    await expect(
      service.createLead(
        {
          name: 'Petar Petrovic',
          email: 'petar@example.com',
          agencyName: 'Drina Bus',
          departuresPerDay: '6-20'
        },
        undefined
      )
    ).resolves.toEqual({
      id: 'clwm0k6q40000s60m5zg7n3c2',
      message: 'Marketing lead received.'
    });
    expect(prismaMock.marketingLead.update).toHaveBeenCalledWith({
      where: { id: 'clwm0k6q40000s60m5zg7n3c2' },
      data: {
        internalEmailSentAt: undefined,
        confirmationEmailSentAt: undefined,
        lastEmailError: 'Email provider unavailable'
      }
    });
  });
});
