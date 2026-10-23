#!/usr/bin/env node
/**
 * Refreshes the committed `openapi.json` snapshot from a URL or local file, then regenerates
 * `types.ts` from it.
 *
 *   npm run types:sync -- <url-or-path> [--no-types]
 *
 * `--no-types` writes `openapi.json` only and skips regenerating `types.ts` (used by the
 * types-drift workflow, where CI regenerates types itself). The flag may appear before or after
 * the source; the source is the first non-flag argument.
 *
 * The spec is re-serialised as deterministic 2-space JSON (see spec-format.mjs) so diffs stay
 * reviewable.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeSpec } from './spec-format.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const skipTypes = args.includes('--no-types');
const source = args.find((a) => !a.startsWith('--'));

if (!source) {
  console.error(
    'Usage: npm run types:sync -- <url-or-path-to-openapi.json> [--no-types]\n' +
      '  deployed API:  npm run types:sync -- $API_URL/openapi.json\n' +
      '  local backend: npm run types:sync -- http://localhost:3000/v1/openapi.json\n' +
      '  backend branch/PR checkout: run `yarn openapi:spec:generate` in llm_engine, then\n' +
      '                 npm run types:sync -- /path/to/llm_engine/openapi.json',
  );
  process.exit(1);
}

try {
  let text;
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    text = await res.text();
  } else {
    text = readFileSync(resolve(source), 'utf8');
  }
  const spec = JSON.parse(text);
  const hasPaths = Object.keys(spec.paths ?? {}).length > 0;
  const hasSchemas = Object.keys(spec.components?.schemas ?? {}).length > 0;
  if (!hasPaths || !hasSchemas) {
    throw new Error('spec has no paths or no component schemas; not overwriting openapi.json');
  }
  writeFileSync(join(root, 'openapi.json'), canonicalizeSpec(text));
} catch (err) {
  console.error(`types:sync: could not load ${source}: ${err.message}`);
  process.exit(1);
}

console.log('types:sync: wrote openapi.json');
if (skipTypes) process.exit(0);
const result = spawnSync(process.execPath, [join(root, 'scripts/ensure-types.mjs'), '--force'], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
