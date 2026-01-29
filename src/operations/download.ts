import type { Attachment, Email, EmailSource, DownloadHooks } from "../types.js"

export type DownloadResult = {
  email: Email
  attachment: Attachment
  index: number
  total: number
}

export type DownloadOptions = {
  hooks?: DownloadHooks
}

export async function* download(
  source: EmailSource,
  emails: AsyncIterable<Email>,
  opts: DownloadOptions = {}
): AsyncIterable<DownloadResult> {
  const { hooks } = opts

  let downloaded = 0

  for await (const email of emails) {
    const total = email.attachments.length

    for (let i = 0; i < email.attachments.length; i++) {
      const meta = email.attachments[i]
      if (!meta) continue

      const data = await source.downloadAttachment(email.id, meta.id)
      const attachment: Attachment = { ...meta, data }

      downloaded++

      if (hooks?.onItem) {
        await hooks.onItem({ email, attachment })
      }

      if (hooks?.onProgress) {
        hooks.onProgress(downloaded, -1) // -1 = unknown total
      }

      yield {
        email,
        attachment,
        index: i + 1,
        total,
      }
    }
  }

  if (hooks?.onComplete) await hooks.onComplete()
}
