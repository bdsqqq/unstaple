import type { NamedAttachment, StorageBackend, StoredFile, StoreHooks } from "../types.js"

export type StoreOptions = {
  hooks?: StoreHooks
}

export async function* store(
  backend: StorageBackend,
  items: AsyncIterable<NamedAttachment>,
  opts: StoreOptions = {}
): AsyncIterable<StoredFile> {
  const { hooks } = opts

  for await (const item of items) {
    const exists = await backend.exists(item.generatedName)

    let result: StoredFile

    if (exists) {
      result = { path: item.generatedName, status: "skipped" }
    } else {
      const path = await backend.write(item.generatedName, item.attachment.data)
      result = { path, status: "written" }
    }

    if (hooks?.onItem) await hooks.onItem(result)

    if (hooks?.onCacheUpdate) {
      await hooks.onCacheUpdate(result, item.email)
    }

    yield result
  }

  if (hooks?.onComplete) await hooks.onComplete()
}
