#!/usr/bin/env node
/**
 * Makes sure the gitignored `types.ts` exists and is current, generating it offline from the
 * committed `openapi.json` (the front end's pinned contract with the LLM Engine backend).
 *
 *   node scripts/ensure-types.mjs [--force]
 *
 * Regenerates when `types.ts` is missing, empty, or older than `openapi.json`. `--force` (or
 * TYPES_FORCE=1) always regenerates. To change the contract itself, use `npm run types:sync`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = join(root, 'openapi.json');
const types = join(root, 'types.ts');
const force = process.argv.includes('--force') || process.env.TYPES_FORCE === '1';

if (!existsSync(spec)) {
  console.error(
    'types:ensure: openapi.json is missing from the repository root.\n' +
      'Restore it from git, or create it with: npm run types:sync -- <url-or-path-to-openapi.json>',
  );
  process.exit(1);
}

const upToDate = existsSync(types) && statSync(types).size > 0 && statSync(types).mtimeMs >= statSync(spec).mtimeMs;

if (upToDate && !force) {
  process.exit(0);
}

console.log(`types:ensure: generating types.ts from openapi.json${force ? ' (forced)' : ''}`);
const result = spawnSync('npx', ['--no', 'openapi-typescript', spec, '--output', types], {
  cwd: root,
  stdio: 'inherit',
});
if (result.status !== 0) {
  console.error(
    'types:ensure: openapi-typescript failed. Run `npm ci` (or `npm install`) so the ' +
      'openapi-typescript devDependency is available, then retry.',
  );
  process.exit(result.status ?? 1);
}
