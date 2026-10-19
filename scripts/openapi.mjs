// Regenerates the web app's API types from the Nest routes: `npm run api:openapi`.
// Builds the API, writes its OpenAPI document (no database needed) and runs openapi-typescript.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps/api');
const webDir = join(root, 'apps/web/web-ui');

// Run each CLI's JS entry with this Node binary: no shell, so paths with spaces are safe on every OS.
function binPath(fromDir, pkg, bin) {
  const manifestPath = createRequire(join(fromDir, 'package.json')).resolve(`${pkg}/package.json`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[bin];
  return join(dirname(manifestPath), entry);
}
const node = (cwd, args) => execFileSync(process.execPath, args, { cwd, stdio: 'inherit' });

const workDir = mkdtempSync(join(tmpdir(), 'cn-openapi-'));
const specPath = join(workDir, 'openapi.json');
try {
  node(apiDir, [binPath(apiDir, '@nestjs/cli', 'nest'), 'build']);
  node(apiDir, [join(apiDir, 'dist/src/openapi.js'), specPath]);
  node(webDir, [
    binPath(webDir, 'openapi-typescript', 'openapi-typescript'),
    specPath,
    '--output',
    join(webDir, 'src/lib/api/schema.d.ts'),
  ]);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
