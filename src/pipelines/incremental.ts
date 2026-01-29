import type { EmailSource, Filter, NamingStrategy, StorageBackend } from "../types.js"
import type { Cache } from "../cache/index.js"
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
  onProgress?: (msg: string) => void
}

/**
 * fetches only emails newer than last sync. updates cache as it goes.
 * if no lastSync exists, behaves like full-sync.
 */
export async function incremental(config: IncrementalConfig): Promise<{ written: number; skipped: number }> {
  const { source, filter, naming, storage, cache, sourceName, onProgress } = config

  const log = onProgress ?? console.log

  await cache.load()
  const lastSync = cache.getLastSync()

  log("authorizing...")
  await source.authorize()

  if (lastSync) {
    log(`incremental sync since ${lastSync.toISOString()}...`)
  } else {
    log("no previous sync found, doing full discovery...")
  }

  log("discovering emails...")
  const ids = discover(source, filter, {
    since: lastSync ?? undefined,
    hooks: {
      onCacheUpdate: async (batch) => {
        log(`discovered ${batch.length} new emails`)
      },
    },
  })

  log("fetching metadata...")
  const emails = fetch(source, ids, {
    hooks: {
      onItem: async (email) => {
        cache.setEmail(email)
      },
    },
  })

  log("downloading attachments...")
  const attachments = download(source, emails)

  async function* withNames() {
    for await (const ctx of attachments) {
      const fullCtx = { ...ctx, source: sourceName }
      const generatedName = name(naming, fullCtx)
      yield { ...fullCtx, generatedName }
    }
  }

  log("storing files...")
  const results = store(storage, withNames(), {
    hooks: {
      onCacheUpdate: async (file, email) => {
        // track which files we've stored for this email
        // uses first attachment id as key since we process sequentially
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
      log(`✓ ${result.path}`)
    } else {
      skipped++
      log(`· ${result.path} (exists)`)
    }
  }

  cache.setLastSync(new Date())
  await cache.flush()

  log(`\ndone! written: ${written}, skipped: ${skipped}`)
  log(`cache: ${cache.emailCount} emails, ${cache.fileCount} files tracked`)

  return { written, skipped }
}
