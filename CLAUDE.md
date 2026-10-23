# Working in this repo

## Committing (husky)

Commits must be [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
`chore:` ...). commitlint (`@commitlint/config-conventional`) enforces the format and a
**100 character maximum per line** in the header, body and footer.

Husky hooks run on every commit/push and **must not be bypassed** (`--no-verify`, `HUSKY=0`):

- [pre-commit](.husky/pre-commit): `npm run lint`; if `openapi.json` is staged, also
  `npm run types:check-spec` (valid JSON in the canonical format `types:sync` writes)
- [commit-msg](.husky/commit-msg): commitlint validates the message
- [prepare-commit-msg](.husky/prepare-commit-msg): interactive commitizen / breaking-change
  prompt that **auto-skips** with no TTY, in CI, or with `HUSKY_NONINTERACTIVE=1`
- [pre-push](.husky/pre-push): `npm run types:ensure` then `npx tsc --noEmit`. Skipped with
  `HUSKY_NONINTERACTIVE=1` or `CI`. Tests and `next build` are not in the hook; CI runs them.

- [post-checkout](.husky/post-checkout), [post-merge](.husky/post-merge),
  [post-rewrite](.husky/post-rewrite): best-effort, silent, offline; run `npm run types:ensure`
  when `openapi.json` changed. They always exit 0 and skip in CI.

## Types and the API contract

`types.ts` is gitignored and generated offline from the committed `openapi.json` (the pinned
contract with the LLM Engine backend). It must exist before tsc or jest: run
`npm run types:ensure` (also runs automatically via `pretest` and pre-push).

- Need new backend fields? Update `openapi.json` with `npm run types:sync -- <url-or-path>`
  (deployed API, local backend, or a backend PR checkout via `yarn openapi:spec:generate` in
  llm_engine), and name the llm_engine PR in the PR description.
- After the backend deploys, run `types:sync` against the deployed API; expect a no-op diff.
- Automation: `.github/workflows/types-drift.yml` runs daily, compares the deployed API's spec
  with `openapi.json`, and opens/updates a PR on `chore/sync-openapi` when they differ. CI
  checks that PR; merge it if green. Undeployed backend changes use the manual path above.

## Checks (run before pushing; none need a TTY)

```bash
npm run types:ensure && npx tsc --noEmit && npm test
npm run build   # needs NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_ABOUT_URL, SESSION_SECRET
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests and build with placeholder env values.
`npm run prettier` and lint are not CI-gated (prettier currently fails on main).
