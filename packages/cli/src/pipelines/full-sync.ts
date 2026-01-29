import type { EmailSource, Filter, NamingStrategy, StorageBackend } from "../types.js"
import type { Logger } from "../logging/index.js"
import { discover } from "../operations/discover.js"
import { fetch } from "../operations/fetch.js"
import { download } from "../operations/download.js"
import { name } from "../operations/name.js"
import { store } from "../operations/store.js"

export type FullSyncConfig = {
  source: EmailSource
  filter: Filter
  naming: NamingStrategy
  storage: StorageBackend
  sourceName: string
  logger?: Logger
  onProgress?: (msg: string) => void
}

export async function fullSync(config: FullSyncConfig): Promise<{ written: number; skipped: number }> {
  const { source, filter, naming, storage, sourceName, logger, onProgress } = config

  const startTime = Date.now()

  logger?.info("authorizing", { operation: "sync", source: sourceName })
  onProgress?.("authorizing...")
  await source.authorize()

  logger?.info("discovering emails", { operation: "discover", source: sourceName })
  onProgress?.("discovering emails...")
  const ids = discover(source, filter)

  logger?.info("fetching metadata", { operation: "fetch", source: sourceName })
  onProgress?.("fetching metadata...")
  const emails = fetch(source, ids)

  logger?.info("downloading attachments", { operation: "download", source: sourceName })
  onProgress?.("downloading attachments...")
  const attachments = download(source, emails)

  async function* withNames() {
    for await (const ctx of attachments) {
      const fullCtx = { ...ctx, source: sourceName }
      const generatedName = name(naming, fullCtx)
      logger?.debug("attachment named", {
        operation: "download",
        emailId: ctx.email.id,
        attachmentId: ctx.attachment.id,
        filename: generatedName,
      })
      yield { ...fullCtx, generatedName }
    }
  }

  logger?.info("storing files", { operation: "store", source: sourceName })
  onProgress?.("storing files...")
  const results = store(storage, withNames())

  let written = 0
  let skipped = 0

  for await (const result of results) {
    if (result.status === "written") {
      written++
      logger?.info("file written", { 
        operation: "store", 
        filename: result.path,
        status: "written" 
      })
      onProgress?.(`✓ ${result.path}`)
    } else {
      skipped++
      logger?.debug("file skipped", { 
        operation: "store", 
        filename: result.path,
        status: "skipped" 
      })
      onProgress?.(`· ${result.path} (exists)`)
    }
  }

  const durationMs = Date.now() - startTime

  logger?.info("sync complete", {
    operation: "sync",
    source: sourceName,
    written,
    skipped,
    durationMs,
  })
  onProgress?.(`\ndone! written: ${written}, skipped: ${skipped}`)

  await logger?.flush()

  return { written, skipped }
}
