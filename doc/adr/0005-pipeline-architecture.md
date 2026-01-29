# 5. pipeline architecture with hooks

date: 2026-01-29

## status

accepted

## context

initial design conflated discovery, fetching, downloading, and naming into a single loop. this bakes in assumptions about:
- what triggers execution (CLI only)
- what order operations run
- when caching happens

we need a design that supports:
- multiple triggers (CLI, cron, webhooks)
- composable operations (mix and match)
- injectable side effects (cache updates, progress reporting)
- streaming/backpressure (don't load everything into memory)

## decision

### separation of concerns

```
TRIGGERS → PIPELINES → OPERATIONS
```

**triggers** (what initiates work):
- CLI: user runs command
- cron: scheduled interval
- webhook: gmail push notification

**pipelines** (what runs):
- full-sync, incremental, redownload, rename
- compose operations differently

**operations** (atomic units):
- discover, fetch, download, name, store, rename
- return `AsyncIterable` for streaming

### operations

| operation | input | output | pure? |
|-----------|-------|--------|-------|
| discover | filter, opts | `AsyncIterable<EmailId>` | yes |
| fetch | email IDs | `AsyncIterable<Email>` | yes |
| download | emails | `AsyncIterable<{email, attachment, index, total}>` | yes |
| name | context | filename string | yes |
| store | named attachments | `AsyncIterable<StoredFile>` | no (writes) |
| rename | old/new paths | `AsyncIterable<StoredFile>` | no (renames) |

### hooks (injectable side effects)

operations accept optional hooks for side effects at boundaries:

```typescript
type Hooks<T> = {
  onItem?: (item: T) => void | Promise<void>
  onBatch?: (items: T[]) => void | Promise<void>
  onComplete?: () => void | Promise<void>
}
```

operation-specific hooks:
- `onCacheUpdate` — persist discovered IDs, metadata, or file paths
- `onProgress` — report download progress

### function signatures

```typescript
// types
type EmailId = string
type Email = { 
  id: EmailId
  date: Date
  from: string
  subject: string
  attachments: AttachmentMeta[] 
}
type AttachmentMeta = { id: string; filename: string; mimeType: string }
type Attachment = AttachmentMeta & { data: Uint8Array }
type NamedAttachment = Attachment & { generatedName: string }
type StoredFile = { path: string; status: "written" | "skipped" | "renamed" }

// operations
declare function discover(
  source: EmailSource,
  filter: Filter,
  opts?: { 
    since?: Date
    hooks?: Hooks<EmailId> & {
      onCacheUpdate?: (ids: EmailId[]) => Promise<void>
    }
  }
): AsyncIterable<EmailId>

declare function fetch(
  source: EmailSource,
  ids: AsyncIterable<EmailId>,
  opts?: {
    hooks?: Hooks<Email> & {
      onCacheUpdate?: (emails: Email[]) => Promise<void>
    }
  }
): AsyncIterable<Email>

declare function download(
  source: EmailSource,
  emails: AsyncIterable<Email>,
  opts?: {
    hooks?: Hooks<{ email: Email; attachment: Attachment }> & {
      onProgress?: (downloaded: number, total: number) => void
    }
  }
): AsyncIterable<{ email: Email; attachment: Attachment; index: number; total: number }>

declare function name(
  strategy: NamingStrategy,
  ctx: { 
    email: Email
    attachment: Attachment
    index: number
    total: number
    source: string 
  }
): string

declare function store(
  backend: StorageBackend,
  items: AsyncIterable<NamedAttachment>,
  opts?: {
    hooks?: Hooks<StoredFile> & {
      onCacheUpdate?: (file: StoredFile, meta: Email) => Promise<void>
    }
  }
): AsyncIterable<StoredFile>

declare function rename(
  backend: StorageBackend,
  files: AsyncIterable<{ oldPath: string; newName: string; meta: Email }>,
  opts?: {
    hooks?: Hooks<StoredFile> & {
      onCacheUpdate?: (oldPath: string, newPath: string, meta: Email) => Promise<void>
    }
  }
): AsyncIterable<StoredFile>
```

### pipeline compositions

```
full-sync:
  discover(gmail, invoiceFilter)
    |> fetch(gmail, _)
    |> download(gmail, _)
    |> map(x => ({ ...x, generatedName: name(invoiceNaming, x) }))
    |> store(localStorage, _)

incremental:
  discover(gmail, invoiceFilter, { since: lastSyncDate })
    |> fetch(gmail, _)
    |> download(gmail, _)
    |> map(x => ({ ...x, generatedName: name(invoiceNaming, x) }))
    |> store(localStorage, _)

redownload:
  loadCache("metadata.json")
    |> download(gmail, _)
    |> map(x => ({ ...x, generatedName: name(invoiceNaming, x) }))
    |> store(localStorage, _)

rename:
  loadCache("metadata.json")
    |> scanExistingFiles(localStorage, _)
    |> map(x => ({ oldPath: x.path, newName: name(invoiceNaming, x.meta), meta: x.meta }))
    |> rename(localStorage, _)
```

### trigger adapters

```typescript
// CLI: parse args, run pipeline, exit
declare function cliAdapter(args: string[]): Promise<void>

// Cron: load config, run incremental pipeline
declare function cronAdapter(config: CronConfig): Promise<void>

// Webhook: validate payload, run incremental for affected emails
declare function webhookAdapter(payload: GmailPushNotification): Promise<void>
```

## consequences

- operations are composable and testable in isolation
- caching is explicit via hooks, not implicit
- same operations work for CLI, cron, or webhook triggers
- streaming via `AsyncIterable` prevents memory bloat on large mailboxes
- adding new sources (outlook) or use cases (rsvps) means implementing interfaces, not modifying core logic
