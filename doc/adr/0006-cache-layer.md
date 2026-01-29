# 6. cache layer for incremental operations

date: 2026-01-29

## status

accepted

## context

full-sync re-discovers and re-fetches all emails every run. wasteful for large mailboxes. incremental sync needs to know "what did we already process?" rename pipeline needs metadata without re-fetching from gmail.

## decision

add a cache layer that persists:
- `lastSync`: timestamp of last successful sync
- `emails`: map of emailId → Email metadata
- `files`: map of emailId → stored file paths

stored as JSON in `.unstaple/cache.json` alongside output dir.

### interface

```typescript
interface Cache {
  getLastSync(): Date | null
  setLastSync(date: Date): void
  
  getEmail(id: EmailId): Email | null
  setEmail(email: Email): void
  getAllEmails(): Email[]
  
  getFilePath(emailId: EmailId, attachmentId: string): string | null
  setFilePath(emailId: EmailId, attachmentId: string, path: string): void
  
  flush(): Promise<void>  // persist to disk
  load(): Promise<void>   // load from disk
}
```

### why JSON, not sqlite

- simpler, no binary dependencies
- human-readable for debugging
- mailbox size is bounded (tens of thousands, not millions)
- can always migrate later if perf becomes issue

## consequences

- incremental sync: `discover(filter, { since: cache.getLastSync() })`
- rename: iterate `cache.getAllEmails()`, match to files, apply new naming
- redownload: use cached metadata, skip discovery
- cache invalidation is manual (delete file to force full resync)
