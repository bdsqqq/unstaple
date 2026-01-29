import * as path from "path"
import type { NamingStrategy, StorageBackend } from "../types.js"
import type { Cache } from "../cache/index.js"
import type { Logger } from "../logging/index.js"
import { rename } from "../operations/rename.js"

export type RenameConfig = {
  naming: NamingStrategy
  storage: StorageBackend
  cache: Cache
  sourceName: string
  logger?: Logger
  onProgress?: (msg: string) => void
}

export async function renameFiles(config: RenameConfig): Promise<{ renamed: number; skipped: number }> {
  const { naming, storage, cache, sourceName, logger, onProgress } = config

  const startTime = Date.now()

  await cache.load()

  const emails = cache.getAllEmails()
  if (emails.length === 0) {
    logger?.warn("cache empty", { operation: "rename", source: sourceName })
    onProgress?.("cache is empty. run sync first to populate metadata.")
    return { renamed: 0, skipped: 0 }
  }

  logger?.info("rename starting", { 
    operation: "rename", 
    source: sourceName,
    emailCount: emails.length 
  })
  onProgress?.(`found ${emails.length} emails in cache`)

  const filePaths = cache.getAllFilePaths()
  logger?.info("files found", { operation: "rename", count: filePaths.length })
  onProgress?.(`found ${filePaths.length} tracked files`)

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
        attachment: { ...attachment, data: new Uint8Array() },
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
      logger?.info("file renamed", { 
        operation: "rename", 
        filename: result.path 
      })
      onProgress?.(`↻ ${path.basename(result.path)}`)
    } else {
      skipped++
      logger?.debug("file skipped", { 
        operation: "rename", 
        filename: result.path,
        status: "skipped" 
      })
    }
  }

  await cache.flush()

  const durationMs = Date.now() - startTime

  logger?.info("rename complete", {
    operation: "rename",
    source: sourceName,
    renamed,
    skipped,
    durationMs,
  })
  onProgress?.(`\ndone! renamed: ${renamed}, skipped: ${skipped}`)

  await logger?.flush()

  return { renamed, skipped }
}
