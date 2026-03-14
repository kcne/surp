import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { createSwaggerDocument } from '../src/config/swagger.config';
import { PrismaService } from '../src/prisma/prisma.service';

async function generateOpenApi(): Promise<void> {
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
