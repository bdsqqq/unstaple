# gmail-invoice-sync goals

created: 2026-01-29

## vision

transform from one-time local extraction script to continuously-running cloud service with improved detection and ergonomics.

---

## goals

### 1. cloud-native continuous sync

run as a service (not one-shot script). requires:
- headless OAuth (service account or refresh token flow)
- incremental sync (track last-synced message, avoid re-processing)
- scheduler or watch-based trigger
- cloud storage destination (S3, GCS, or similar)

### 2. improved detection

known misses exist in current query logic. needs:
- audit of false negatives (invoices that weren't caught)
- expanded query patterns
- possibly ML-based classification or heuristics beyond subject/sender

### 3. better naming convention

current: `{date} {email-prefix} -- {attachment-name}.pdf`

problem: stripping domain makes vendor search harder. e.g., `auto-confirm` doesn't tell you it's Amazon.

proposed: include domain or vendor normalization.

### 4. tooling modernization

- runtime: migrate to bun (faster, simpler)
- formatting/linting: oxc (faster than eslint/prettier)
- testing: add test coverage

### 5. architecture refactoring

- separate concerns (auth, search, download, storage)
- configuration externalized (env vars, config file)
- error handling and retry logic
- logging structured for observability

---

## immediate priorities (2026-01-29)

### phase 1: tooling setup
- [ ] add bun as runtime (keep pnpm for packages)
- [ ] add oxc for linting + formatting
- [ ] update package.json scripts
- [ ] verify existing functionality still works

### phase 2: modular refactor
- [ ] split index.ts into modules (auth, sources, filters, extractors, naming, storage)
- [ ] define interfaces for each module
- [ ] wire modules in new index.ts

### phase 3: feature improvements
- [ ] new naming convention (person + company extraction)
- [ ] add millennium "extrato combinado" to search queries
- [ ] (future) incremental sync
- [ ] (future) cloud deployment
