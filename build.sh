#!/bin/sh
# Vercel build entrypoint (see vercel.json). types.ts is generated here rather than
# committed, so it always matches the API this deployment talks to.
set -eu

if [ -z "${NEXT_PUBLIC_API_URL:-}" ]; then
  echo "build.sh: NEXT_PUBLIC_API_URL is not set — cannot generate API types from the OpenAPI spec." >&2
  exit 1
fi

# Prefer the version pinned in package.json over whatever npm publishes as latest, so the
# generated types don't change under us between deploys. Fall back to a global install
# (pinned to the same range) if devDependencies weren't installed.
if [ ! -x node_modules/.bin/openapi-typescript ]; then
  npm i -g "openapi-typescript@$(node -p "require('./package.json').devDependencies['openapi-typescript']")"
fi

npm run openapi-types:generate "$NEXT_PUBLIC_API_URL/openapi.json"

# An OpenAPI document with no components is structurally valid, and openapi-typescript
# renders it as `schemas: never` rather than failing — which makes every generated model
# `never` and shows up much later as "Property 'x' does not exist on type 'never'" inside
# unrelated components. Catch it here, where the cause is visible.
if grep -q 'schemas: never' types.ts || ! grep -q '        Message: {' types.ts; then
  echo "build.sh: $NEXT_PUBLIC_API_URL/openapi.json returned a spec with no schemas — generated types.ts is empty." >&2
  echo "         The API serves an empty spec when it can't find its spec sources; check that deployment first." >&2
  exit 1
fi

npm run build
