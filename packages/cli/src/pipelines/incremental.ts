import type { EmailSource, Filter, NamingStrategy, StorageBackend } from "../types.js"
import type { Cache } from "../cache/index.js"
import type { Logger } from "../logging/index.js"
import { discover } from "../operations/discover.js"
import { fetch } from "../operations/fetch.js"
import { download } from "../operations/download.js"
import { name } from "../operations/name.js"
import { store } from "../operations/store.js"

export type IncrementalConfig = {
  source: EmailSource
  filter: Filter
  naming: NamingStrategy
  storage: StorageBackend
  cache: Cache
  sourceName: string
  logger?: Logger
  onProgress?: (msg: string) => void
}

/**
 * fetches only emails newer than last sync. updates cache as it goes.
 * if no lastSync exists, behaves like full-sync.
 */
export async function incremental(config: IncrementalConfig): Promise<{ written: number; skipped: number }> {
  const { source, filter, naming, storage, cache, sourceName, logger, onProgress } = config

  const startTime = Date.now()

  await cache.load()
  const lastSync = cache.getLastSync()

  logger?.info("authorizing", { operation: "sync", source: sourceName })
  onProgress?.("authorizing...")
  await source.authorize()

  if (lastSync) {
    logger?.info("incremental sync starting", { 
      operation: "sync", 
      source: sourceName,
      since: lastSync.toISOString() 
    })
    onProgress?.(`incremental sync since ${lastSync.toISOString()}...`)
  } else {
    logger?.info("full discovery starting", { operation: "sync", source: sourceName })
    onProgress?.("no previous sync found, doing full discovery...")
  }

  logger?.info("discovering emails", { operation: "discover", source: sourceName })
  onProgress?.("discovering emails...")
  const ids = discover(source, filter, {
    since: lastSync ?? undefined,
    hooks: {
      onCacheUpdate: async (batch) => {
        logger?.info("emails discovered", { operation: "discover", count: batch.length })
        onProgress?.(`discovered ${batch.length} new emails`)
      },
    },
  })

  logger?.info("fetching metadata", { operation: "fetch", source: sourceName })
  onProgress?.("fetching metadata...")
  const emails = fetch(source, ids, {
    hooks: {
      onItem: async (email) => {
        logger?.debug("email fetched", { 
          operation: "fetch", 
          emailId: email.id,
          attachmentCount: email.attachments.length 
        })
        cache.setEmail(email)
      },
    },
  })

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
  const results = store(storage, withNames(), {
    hooks: {
      onCacheUpdate: async (file, email) => {
        const att = email.attachments[0]
        if (att) {
          cache.setFilePath(email.id, att.id, file.path)
        }
      },
    },
  })

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

  cache.setLastSync(new Date())
  await cache.flush()

  const durationMs = Date.now() - startTime

  logger?.info("sync complete", {
    operation: "sync",
    source: sourceName,
    written,
    skipped,
    emailCount: cache.emailCount,
    fileCount: cache.fileCount,
    durationMs,
  })
  onProgress?.(`\ndone! written: ${written}, skipped: ${skipped}`)
  onProgress?.(`cache: ${cache.emailCount} emails, ${cache.fileCount} files tracked`)

  await logger?.flush()

  return { written, skipped }
}
