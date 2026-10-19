// Removes build output, caches and old local uploads in every workspace: `npm run clean`.
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  'apps/api/dist',
  'apps/api/coverage',
  'apps/api/tsconfig.tsbuildinfo',
  'apps/api/tsconfig.build.tsbuildinfo',
  'apps/web/web-ui/.next',
  'apps/web/web-ui/tsconfig.tsbuildinfo',
  'node_modules/.cache',
  'apps/api/node_modules/.cache',
  'apps/web/web-ui/node_modules/.cache',
  // Uploads written to disk before 13.6; nothing writes here any more.
  'apps/api/tmp',
];

for (const target of targets) {
  rmSync(join(root, target), { recursive: true, force: true });
  console.log(`removed ${target}`);
}
