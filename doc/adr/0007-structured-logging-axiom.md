# 7. structured logging with axiom

date: 2026-01-29

## status

accepted

## context

current codebase uses `console.log` via `onProgress?: (msg: string) => void` callbacks. this works for local debugging but fails for cloud observability:

- no structured fields (emailId, attachmentId, operation, duration)
- no log levels (info vs warn vs error)
- no centralized log aggregation
- no correlation between events

goals.md specifies "structured logging for observability" under architecture refactoring.

## decision

use axiom's official logging library: `@axiomhq/logging` + `@axiomhq/js`.

### why `@axiomhq/logging` over raw `@axiomhq/js`

| option | structured by default | transports | log levels |
|--------|----------------------|------------|------------|
| `@axiomhq/js` | no (raw ingest) | manual | manual |
| `@axiomhq/logging` | yes | built-in | built-in |

`@axiomhq/logging` provides:
- `Logger` class with info/warn/error/debug
- transport abstraction: `AxiomJSTransport`, `ConsoleTransport`
- structured fields on every log call
- automatic batching and flushing

### architecture

```
src/
  logging/
    index.ts      # exports createLogger, log types
    config.ts     # env-based transport setup
```

logger is created once in entry point, passed to pipelines via config. pipelines use structured log calls instead of string-only `onProgress`.

### log schema

```typescript
type LogContext = {
  operation: "discover" | "fetch" | "download" | "store" | "rename"
  emailId?: string
  attachmentId?: string
  filename?: string
  durationMs?: number
  count?: number
}
```

### example usage

```typescript
// before
log(`discovered ${batch.length} new emails`)

// after
logger.info("emails discovered", { 
  operation: "discover", 
  count: batch.length 
})
```

### environment variables

| var | required | description |
|-----|----------|-------------|
| `AXIOM_TOKEN` | yes (cloud) | api token with ingest permission |
| `AXIOM_DATASET` | yes (cloud) | target dataset name |
| `LOG_LEVEL` | no | debug/info/warn/error (default: info) |

local-only mode: if `AXIOM_TOKEN` is unset, only `ConsoleTransport` is used.

### backward compatibility

`onProgress` remains available for callers who want simple string output. internally, pipelines call the structured logger; progress callbacks get derived strings.

## consequences

- logs ship to axiom when configured, enabling dashboards and alerts
- log calls include context (emailId, operation, duration) for debugging
- local development works without axiom config (console fallback)
- slight overhead from batching/flushing, acceptable for this use case
