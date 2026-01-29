import type { EmailId, EmailSource, Filter, DiscoverHooks } from "../types.js"

export type DiscoverOptions = {
  since?: Date
  hooks?: DiscoverHooks
}

export async function* discover(
  source: EmailSource,
  filter: Filter,
  opts: DiscoverOptions = {}
): AsyncIterable<EmailId> {
  const { hooks } = opts

  const batch: EmailId[] = []

  for await (const id of source.discover(filter, { since: opts.since })) {
    if (hooks?.onItem) await hooks.onItem(id)
    batch.push(id)
    yield id
  }

  if (hooks?.onBatch && batch.length > 0) {
    await hooks.onBatch(batch)
  }

  if (hooks?.onCacheUpdate && batch.length > 0) {
    await hooks.onCacheUpdate(batch)
  }

  if (hooks?.onComplete) await hooks.onComplete()
}
