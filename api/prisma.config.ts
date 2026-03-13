import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  seed: 'ts-node --transpile-only prisma/seed.ts'
});
