import type { EmailSource, Filter, NamingStrategy, StorageBackend } from "../types.js"
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
  onProgress?: (msg: string) => void
}

export async function fullSync(config: FullSyncConfig): Promise<{ written: number; skipped: number }> {
  const { source, filter, naming, storage, sourceName, onProgress } = config

  const log = onProgress ?? console.log

  log("authorizing...")
  await source.authorize()

  log("discovering emails...")
  const ids = discover(source, filter)

  log("fetching metadata...")
  const emails = fetch(source, ids)

  log("downloading attachments...")
  const attachments = download(source, emails)

  // transform to named attachments
  async function* withNames() {
    for await (const ctx of attachments) {
      const fullCtx = { ...ctx, source: sourceName }
      const generatedName = name(naming, fullCtx)
      yield { ...fullCtx, generatedName }
    }
  }

  log("storing files...")
  const results = store(storage, withNames())

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

  log(`\ndone! written: ${written}, skipped: ${skipped}`)

  return { written, skipped }
}
