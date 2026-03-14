import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

async function lintOpenApi(): Promise<void> {
  const schemaPath = join(process.cwd(), 'docs', 'openapi.json');
  const schemaRaw = await readFile(schemaPath, 'utf8');
  const schema = JSON.parse(schemaRaw);

  await SwaggerParser.validate(schema);
  console.log(`OpenAPI schema is valid: ${schemaPath}`);
}

void lintOpenApi();
