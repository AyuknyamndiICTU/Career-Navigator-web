// Removes build output and caches in every workspace: `npm run clean`.
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
];

for (const target of targets) {
  rmSync(join(root, target), { recursive: true, force: true });
  console.log(`removed ${target}`);
}
