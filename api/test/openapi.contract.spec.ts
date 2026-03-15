import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AppModule } from '../src/app.module';
import { OPENAPI_VERSION, createSwaggerDocument } from '../src/config/swagger.config';
import { PrismaService } from '../src/prisma/prisma.service';

describe('OpenAPI contract', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
        enableShutdownHooks: async () => undefined,
        isHealthy: async () => true
      })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    document = createSwaggerDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses a stable OpenAPI version tag', () => {
    expect(document.info.version).toBe(OPENAPI_VERSION);
  });

  it('documents auth login operation and error responses', () => {
    const login = document.paths['/auth/login']?.post;

    expect(login).toBeDefined();
    expect(login?.responses['200']).toBeDefined();
    expect(login?.responses['400']).toBeDefined();
    expect(login?.responses['401']).toBeDefined();
    expect(login?.responses['403']).toBeDefined();
    expect(login?.responses['404']).toBeDefined();
  });

  it('documents protected users endpoint with bearer auth and tenant header', () => {
    const listUsers = document.paths['/users']?.get;
    expect(listUsers).toBeDefined();

    const hasBearerSecurity =
      listUsers?.security?.some((entry) => Object.prototype.hasOwnProperty.call(entry, 'access-token')) ??
      false;

    expect(hasBearerSecurity).toBe(true);

    const tenantHeader = listUsers?.parameters?.find(
      (parameter) =>
        '$ref' in parameter === false &&
        parameter.in === 'header' &&
        parameter.name.toLowerCase() === 'x-tenant-slug'
    );

    expect(tenantHeader).toBeDefined();
    if (tenantHeader && '$ref' in tenantHeader === false) {
      expect(tenantHeader.required).toBe(true);
    }
  });

  it('keeps health endpoint public', () => {
    const health = document.paths['/health']?.get;

    expect(health).toBeDefined();
    expect(health?.security).toBeUndefined();
  });

  it('documents platform tenants endpoint with bearer auth and without tenant header requirement', () => {
    const listPlatformTenants = document.paths['/platform/tenants']?.get;
    expect(listPlatformTenants).toBeDefined();

    const hasBearerSecurity =
      listPlatformTenants?.security?.some((entry) =>
        Object.prototype.hasOwnProperty.call(entry, 'access-token')
      ) ?? false;

    expect(hasBearerSecurity).toBe(true);

    const tenantHeader = listPlatformTenants?.parameters?.find(
      (parameter) =>
        '$ref' in parameter === false &&
        parameter.in === 'header' &&
        parameter.name.toLowerCase() === 'x-tenant-slug'
    );

    expect(tenantHeader).toBeUndefined();
  });

  it('keeps platform tenant login options endpoint public', () => {
    const publicTenantOptions = document.paths['/platform/tenants/public']?.get;

    expect(publicTenantOptions).toBeDefined();
    expect(publicTenantOptions?.security).toBeUndefined();
  });
});
