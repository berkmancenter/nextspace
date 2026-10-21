/**
 * Canonical on-disk format for `openapi.json`: the parsed spec re-serialised as 2-space JSON
 * with a trailing newline (key order is preserved, not sorted). Shared by `types:sync`, which
 * writes it, and `types:check-spec`, which verifies it.
 */
export function canonicalizeSpec(text) {
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}
