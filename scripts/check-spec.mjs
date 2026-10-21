#!/usr/bin/env node
/**
 * Verifies that `openapi.json` parses as JSON and is in the canonical format that
 * `npm run types:sync` writes. Used by the pre-commit hook (when openapi.json is staged) and CI.
 *
 *   node scripts/check-spec.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeSpec } from './spec-format.mjs';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json');
const fix = 'Fix: npm run types:sync -- ./openapi.json';

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (err) {
  console.error(`types:check-spec: cannot read openapi.json: ${err.message}`);
  process.exit(1);
}

let canonical;
try {
  canonical = canonicalizeSpec(text);
} catch (err) {
  console.error(`types:check-spec: openapi.json is not valid JSON (${err.message}). ${fix}`);
  process.exit(1);
}

if (canonical !== text) {
  console.error(`types:check-spec: openapi.json is not in canonical formatting. ${fix}`);
  process.exit(1);
}
