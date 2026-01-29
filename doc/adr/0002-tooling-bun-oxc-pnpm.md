# 2. tooling: bun runtime, oxc linting, pnpm packages

date: 2026-01-29

## status

accepted

## context

current stack uses tsx for TypeScript execution and has no linting/formatting. we want:
- faster runtime
- binary distribution for deployment
- consistent code style
- modern tooling without eslint/prettier complexity

## decision

- **runtime**: bun (replaces tsx for execution, enables binary compilation via `bun build --compile`)
- **linting + formatting**: oxc (faster than eslint/prettier, single tool)
- **package manager**: pnpm (keep existing, no migration needed)

## consequences

- `pnpm run start` → `bun run src/index.ts`
- add `oxlint` and format scripts
- can produce standalone binary for cloud deployment
- tsx becomes dev-only or removed entirely
