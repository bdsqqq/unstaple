# unstaple

extract attachments from gmail. automatic vendor detection, incremental sync, sane filenames.

```bash
pnpm install
bun run src/index.ts sync
```

## commands

### `sync` — incremental sync

```bash
unstaple sync

# fetches only new emails since last run
# caches metadata for future operations
# outputs: 2024-03-15 amazon Order_123 id_abc123 1_of_1 -- source__gmail.pdf
```

### `full-sync` — full rescan

```bash
unstaple full-sync

# ignores cache, re-fetches everything
# use when query patterns change
```

### `rename` — apply new naming

```bash
unstaple rename

# uses cached metadata to rename existing files
# no re-download needed
```

## filename format

```
{date} {person} {company} {attachment} id_{emailId} {i}_of_{n} -- source__gmail.ext
```

examples:
- `2024-03-15 amazon Order_123 id_abc123 1_of_1 -- source__gmail.pdf`
- `2024-03-15 lourival sistecon invoice id_xyz789 1_of_2 -- source__gmail.pdf`

generic prefixes (`noreply`, `naoresponder`, etc.) are stripped. person omitted if generic.

## detection

two query strategies OR'd:

**content-based** — subject contains: `invoice`, `receipt`, `fatura`, `recibo`, `order`, `confirmation`, `pagamento`, `comprovante`, `extrato combinado`

**sender-based** — from known vendors: `fnac`, `worten`, `apple`, `amazon`, `uber`, `wise`, `n26`, `netflix`, `spotify`, `google`, `microsoft`, `adobe`, `github`, `vercel`, `railway`, `hetzner`, `namecheap`, `stripe`, `paddle`, `millennium`

## setup

1. create google cloud project with gmail API enabled
2. download OAuth credentials JSON
3. place in `~/.config/unstaple/credentials.json`
4. run `unstaple auth` — browser opens for auth, token cached

```bash
# or override paths via env vars
export UNSTAPLE_CREDENTIALS_PATH=/path/to/credentials.json
export UNSTAPLE_TOKEN_PATH=/path/to/token.json
export UNSTAPLE_OUTPUT_DIR=/path/to/output
```

## architecture

```
src/
├── index.ts           # CLI entry
├── types.ts           # shared interfaces
├── cache/             # JSON persistence
├── filters/           # query builders
├── operations/        # discover, fetch, download, name, store, rename
├── pipelines/         # full-sync, incremental, rename
├── sources/           # gmail
└── storage/           # local fs
```

pipeline architecture with hooks — operations are composable, streaming via `AsyncIterable`.

see [doc/adr/](doc/adr/) for architectural decisions.

## scripts

```bash
pnpm run start      # bun run src/index.ts
pnpm run dev        # bun run --watch
pnpm run build      # bun build --compile
pnpm run check      # tsc --noEmit
pnpm run lint       # oxlint
```

## install

### nix (flakes)

```bash
nix run github:bdsqqq/unstaple -- sync
```

or add to your flake inputs.

### binary

grab from [releases](https://github.com/bdsqqq/unstaple/releases).

## license

MIT
