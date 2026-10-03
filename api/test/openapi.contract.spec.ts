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
    await app?.close();
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

  it('documents the departure reads with bearer auth, the tenant header and their errors', () => {
    const list = document.paths['/departures']?.get;
    const detail = document.paths['/departures/{id}']?.get;

    for (const operation of [list, detail]) {
      expect(operation?.security?.some((entry) => 'access-token' in entry)).toBe(true);
      expect(
        operation?.parameters?.some(
          (parameter) =>
            '$ref' in parameter === false &&
            parameter.in === 'header' &&
            parameter.name.toLowerCase() === 'x-tenant-slug' &&
            parameter.required === true
        )
      ).toBe(true);
    }

    const query = (list?.parameters ?? []).flatMap((parameter) =>
      '$ref' in parameter === false && parameter.in === 'query' ? [[parameter.name, parameter.required]] : []
    );
    expect(Object.fromEntries(query)).toEqual({ from: true, to: true, rideId: false, lineId: false });
    expect(list?.responses['400']).toBeDefined();
    expect(detail?.responses['404']).toBeDefined();
  });

  it('documents the departure operations for ADMIN and MANAGER with their refusals', () => {
    const create = document.paths['/departures']?.post;
    const cancel = document.paths['/departures/{id}/cancel']?.post;
    const restore = document.paths['/departures/{id}/restore']?.post;
    const update = document.paths['/departures/{id}']?.patch;
    const remove = document.paths['/departures/{id}']?.delete;

    for (const operation of [create, cancel, restore, update, remove]) {
      expect(operation?.security?.some((entry) => 'access-token' in entry)).toBe(true);
      expect(operation?.responses['400']).toBeDefined();
      expect(operation?.responses['403']).toBeDefined();
    }
    for (const operation of [cancel, restore, update, remove]) {
      expect(operation?.responses['409']).toBeDefined();
    }
    // An extra bus may share its time with another bus since #27 PR 4c, so
    // adding one has nothing left to refuse with 409.
    expect(create?.responses['409']).toBeUndefined();
    expect(JSON.stringify(document)).not.toContain('DEPARTURE_TIME_TAKEN');

    expect(create?.responses['201']).toBeDefined();
    expect(create?.responses['404']).toBeDefined();
    for (const operation of [cancel, restore, update, remove]) {
      expect(operation?.responses['200']).toBeDefined();
      expect(operation?.responses['404']).toBeDefined();
    }

    const bodyRef = (operation: typeof create) =>
      (operation?.requestBody as { content?: Record<string, { schema?: { $ref?: string } }> } | undefined)
        ?.content?.['application/json']?.schema?.$ref;
    expect(bodyRef(create)).toBe('#/components/schemas/CreateExtraDepartureDto');
    expect(bodyRef(cancel)).toBe('#/components/schemas/CancelDepartureDto');
    expect(bodyRef(update)).toBe('#/components/schemas/UpdateExtraDepartureDto');

    const stateRef = '#/components/schemas/DepartureOperationRefusalDto';
    for (const operation of [cancel, restore, update, remove]) {
      const response = operation!.responses['409']!;
      if ('$ref' in response) throw new Error('Expected inline response');
      const schema = response.content!['application/json'].schema!;
      const variants = '$ref' in schema ? [schema] : schema.oneOf;
      expect(variants).toContainEqual({ $ref: stateRef });
    }
    const states = document.components!.schemas!.DepartureOperationRefusalDto;
    if ('$ref' in states) throw new Error('Expected inline schema');
    expect(states.required).toEqual(expect.arrayContaining(['code', 'message']));
    expect(states.properties!.code).toMatchObject({
      enum: expect.arrayContaining(['DEPARTURE_ALREADY_CANCELLED', 'DEPARTURE_NOT_CANCELLED', 'DEPARTURE_HAS_RESERVATIONS'])
    });
  });

  it('types the nullable departure fields as strings, not objects', () => {
    const schemas = document.components?.schemas ?? {};
    const property = (schema: string, name: string) =>
      (schemas[schema] as { properties?: Record<string, unknown> } | undefined)?.properties?.[name];

    expect(property('DepartureStopResponseDto', 'time')).toMatchObject({ type: 'string', nullable: true });
    expect(property('DepartureResponseDto', 'cancelledById')).toMatchObject({ type: 'string', nullable: true });
    for (const name of ['timetableDroppedAt', 'cancelledAt']) {
      expect(property('DepartureResponseDto', name)).toMatchObject({
        type: 'string',
        format: 'date-time',
        nullable: true
      });
    }
  });

  it('keeps platform tenant login options endpoint public', () => {
    const publicTenantOptions = document.paths['/platform/tenants/public']?.get;

    expect(publicTenantOptions).toBeDefined();
    expect(publicTenantOptions?.security).toBeUndefined();
  });
});
