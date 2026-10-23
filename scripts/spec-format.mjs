/**
 * Canonical on-disk format for `openapi.json`: the parsed spec re-serialised as 2-space JSON
 * with a trailing newline. Keys are not sorted, but `JSON.stringify(JSON.parse())` hoists
 * integer-like keys (e.g. response status codes "200", "404") to the front of their object in
 * ascending order; all other keys keep their original insertion order. Shared by `types:sync`, which
 * writes it, and `types:check-spec`, which verifies it.
 */
export function canonicalizeSpec(text) {
  return JSON.stringify(JSON.parse(text), null, 2) + '\n';
}
