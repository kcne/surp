import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { OpenAPIObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const OPENAPI_VERSION = '0.1.0';

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SURP API')
    .setDescription(
      'Backend API for SURP, providing tenant-scoped authentication, operational health endpoints, and secure session management for transportation workflows. Protected endpoints require BOTH Authorization: Bearer <accessToken> and X-Tenant-Slug headers (except /platform/* routes), and the tenant must match the token claim.'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token issued by /auth/login. Use together with X-Tenant-Slug on protected endpoints.'
      },
      'access-token'
    )
    .setVersion(OPENAPI_VERSION)
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}
