# 3. modular architecture for composability

date: 2026-01-29

## status

accepted

## context

current code is a single 186-line file. works fine for one-shot gmail invoice extraction, but we want:
- testability (mock individual components)
- composability (swap gmail for outlook, invoices for rsvps)
- dependency injection patterns

## decision

separate concerns into modules:

```
packages/cli/src/
├── index.ts              # entry point, wires modules together
├── auth/                 # oauth flows (gmail, outlook, etc.)
├── sources/              # email fetching (gmail, outlook, etc.)
├── filters/              # query builders, pattern matchers
├── extractors/           # attachment extraction, MIME traversal
├── naming/               # filename generation, vendor normalization
├── storage/              # local fs, S3, GCS, etc.
└── types.ts              # shared interfaces
```

each module exposes a clean interface. `index.ts` composes them.

**update 2026-01-29**: refactored to turborepo monorepo with cli in `packages/cli/` for changeset compatibility.

## consequences

- can unit test each module in isolation
- can add new sources (outlook) without touching extraction logic
- can add new use cases (rsvps) by swapping filter + naming modules
- slightly more files, but each is focused
