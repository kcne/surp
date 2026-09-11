import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { applyOfflineEnv } from './offline-env';

async function generateOpenApi(): Promise<void> {
  // AppModule validates the environment as it loads, so the placeholders have
  // to be in place first. That is why the imports below are dynamic: a static
  // import is hoisted above this call, and the generator would go back to
  // demanding real S3 credentials to write a JSON file.
  applyOfflineEnv();

  const { AppModule } = await import('../src/app.module');
  const { createSwaggerDocument } = await import('../src/config/swagger.config');
  const { PrismaService } = await import('../src/prisma/prisma.service');

  const testingModule = await Test.createTestingModule({
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

  const app = testingModule.createNestApplication({ logger: false });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  const document = createSwaggerDocument(app);
  const outputPath = join(process.cwd(), 'docs', 'openapi.json');

  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  await app.close();

  Logger.log(`OpenAPI schema written to ${outputPath}`, 'OpenApiGenerator');
}

void generateOpenApi();
