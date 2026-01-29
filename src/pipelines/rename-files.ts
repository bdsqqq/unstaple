import * as path from "path"
import type { NamingStrategy, StorageBackend } from "../types.js"
import type { Cache } from "../cache/index.js"
import { rename } from "../operations/rename.js"

export type RenameConfig = {
  naming: NamingStrategy
  storage: StorageBackend
  cache: Cache
  sourceName: string
  onProgress?: (msg: string) => void
}

/**
 * applies current naming strategy to existing files using cached metadata.
 * useful when naming logic changes and you want to update filenames without re-downloading.
 *
 * requires prior sync to populate cache. if cache is empty, does nothing.
 */
export async function renameFiles(config: RenameConfig): Promise<{ renamed: number; skipped: number }> {
  const { naming, storage, cache, sourceName, onProgress } = config

  const log = onProgress ?? console.log

  await cache.load()

  const emails = cache.getAllEmails()
  if (emails.length === 0) {
    log("cache is empty. run sync first to populate metadata.")
    return { renamed: 0, skipped: 0 }
  }

  log(`found ${emails.length} emails in cache`)

  const filePaths = cache.getAllFilePaths()
  log(`found ${filePaths.length} tracked files`)

  /**
   * builds rename operations by matching cached file paths to emails,
   * then generating new names from current naming strategy.
   */
  async function* buildRenameOps() {
    for (const { emailId, attachmentId, path: oldPath } of filePaths) {
      const email = cache.getEmail(emailId)
      if (!email) continue

      const attachment = email.attachments.find((a) => a.id === attachmentId)
      if (!attachment) continue

      const index = email.attachments.indexOf(attachment) + 1
      const total = email.attachments.length

      const newName = naming.generate({
        email,
        attachment: { ...attachment, data: new Uint8Array() }, // data not needed for naming
        index,
        total,
        source: sourceName,
      })

      yield { oldPath, newName, meta: email }
    }
  }

  const results = rename(storage, buildRenameOps(), {
    hooks: {
      onCacheUpdate: async (oldPath, newPath, email) => {
        // update cache with new path
        const att = email.attachments[0]
        if (att) {
          cache.setFilePath(email.id, att.id, newPath)
        }
      },
    },
  })

  let renamed = 0
  let skipped = 0

  for await (const result of results) {
    if (result.status === "renamed") {
      renamed++
      log(`↻ ${path.basename(result.path)}`)
    } else {
      skipped++
    }
  }

  await cache.flush()

  log(`\ndone! renamed: ${renamed}, skipped: ${skipped}`)

  return { renamed, skipped }
}
