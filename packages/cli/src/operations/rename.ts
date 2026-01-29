import type { Email, StorageBackend, StoredFile, RenameHooks } from "../types.js"

export type RenameItem = {
  oldPath: string
  newName: string
  meta: Email
}

export type RenameOptions = {
  hooks?: RenameHooks
}

export async function* rename(
  backend: StorageBackend,
  files: AsyncIterable<RenameItem>,
  opts: RenameOptions = {}
): AsyncIterable<StoredFile> {
  const { hooks } = opts

  for await (const { oldPath, newName, meta } of files) {
    if (oldPath === newName) {
      const result: StoredFile = { path: oldPath, status: "skipped" }
      if (hooks?.onItem) await hooks.onItem(result)
      yield result
      continue
    }

    const newPath = await backend.rename(oldPath, newName)
    const result: StoredFile = { path: newPath, status: "renamed" }

    if (hooks?.onItem) await hooks.onItem(result)

    if (hooks?.onCacheUpdate) {
      await hooks.onCacheUpdate(oldPath, newPath, meta)
    }

    yield result
  }

  if (hooks?.onComplete) await hooks.onComplete()
}
