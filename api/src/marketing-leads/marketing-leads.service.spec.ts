import { MarketingLeadsEmailService } from './marketing-leads-email.service';
import { MarketingLeadsService } from './marketing-leads.service';

describe('MarketingLeadsService', () => {
  const emailServiceMock = {
    sendLeadNotification: jest.fn()
  };

  let service: MarketingLeadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingLeadsService(emailServiceMock as unknown as MarketingLeadsEmailService);
  });

  it('sends an email notification for a valid lead', async () => {
    const dto = {
      name: 'Petar Petrovic',
      email: 'petar@example.com',
      agencyName: 'Drina Bus',
      phone: '+381 64 123 4567',
      departuresPerDay: '6-20' as const,
      message: 'Zelimo online rezervacije.'
    };

    const result = await service.createLead(dto, '127.0.0.1');

    expect(result.id).toMatch(/^mlead_/);
    expect(result.message).toBe('Marketing lead received.');
    expect(emailServiceMock.sendLeadNotification).toHaveBeenCalledWith(result.id, dto, '127.0.0.1');
  });

  it('does not return success when email notification fails', async () => {
    emailServiceMock.sendLeadNotification.mockRejectedValue(new Error('SMTP unavailable'));

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
    ).rejects.toThrow('SMTP unavailable');
  });
});
