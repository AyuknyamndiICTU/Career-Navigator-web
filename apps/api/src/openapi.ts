// Writes the OpenAPI document without a database or Redis: `node dist/src/openapi.js <out.json>`.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { API_PREFIX } from './lib/api-prefix';
import { buildOpenApiDocument } from './swagger';

async function main(): Promise<void> {
  const out = resolve(process.argv[2] ?? 'openapi.json');
  // Preview mode resolves the module graph for route metadata without instantiating providers.
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error'],
  });
  app.setGlobalPrefix(API_PREFIX);
  writeFileSync(out, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI document written to ${out}`);
}

void main();
