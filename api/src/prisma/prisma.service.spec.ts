import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('connects on module init and disconnects on module destroy', async () => {
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue();
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('runs smoke query successfully', async () => {
    const querySpy = jest.spyOn(service, '$queryRaw').mockResolvedValue([]);

    await service.smokeQuery();

    expect(querySpy).toHaveBeenCalledTimes(1);
  });

  it('reports unhealthy when smoke query fails', async () => {
    jest.spyOn(service, 'smokeQuery').mockRejectedValue(new Error('db down'));

    await expect(service.isHealthy()).resolves.toBe(false);
  });
});
