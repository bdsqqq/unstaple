import type { Email, EmailId, EmailSource, FetchHooks } from "../types.js"

export type FetchOptions = {
  hooks?: FetchHooks
  batchSize?: number
}

export async function* fetch(
  source: EmailSource,
  ids: AsyncIterable<EmailId>,
  opts: FetchOptions = {}
): AsyncIterable<Email> {
  const { hooks, batchSize = 50 } = opts

  const batch: Email[] = []

  for await (const email of source.fetch(ids)) {
    if (hooks?.onItem) await hooks.onItem(email)
    batch.push(email)

    if (hooks?.onBatch && batch.length >= batchSize) {
      await hooks.onBatch([...batch])
      batch.length = 0
    }

    yield email
  }

  if (hooks?.onBatch && batch.length > 0) {
    await hooks.onBatch(batch)
  }

  if (hooks?.onCacheUpdate) {
    await hooks.onCacheUpdate(batch)
  }

  if (hooks?.onComplete) await hooks.onComplete()
}
