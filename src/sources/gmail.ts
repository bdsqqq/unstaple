import { google, gmail_v1 } from "googleapis"
import * as fs from "fs"
import * as path from "path"
import type { Email, EmailId, EmailSource, Filter, AttachmentMeta } from "../types.js"
import { getTokenPath } from "../config/index.js"

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"])

export type GmailSourceConfig = {
  tokenPath?: string
}

export class GmailSource implements EmailSource {
  private gmail: gmail_v1.Gmail | null = null
  private tokenPath: string

  constructor(config: GmailSourceConfig = {}) {
    this.tokenPath = config.tokenPath ?? getTokenPath()
  }

  async authorize(): Promise<void> {
    if (!fs.existsSync(this.tokenPath)) {
      throw new Error(`not authenticated. run: gmail-invoice-sync auth`)
    }

    const content = fs.readFileSync(this.tokenPath, "utf-8")
    const credentials = JSON.parse(content)
    const auth = google.auth.fromJSON(credentials)

    this.gmail = google.gmail({ version: "v1", auth: auth as any })
  }

  async *discover(filter: Filter, opts?: { since?: Date }): AsyncIterable<EmailId> {
    if (!this.gmail) throw new Error("not authorized")

    const queries = filter.getQueries()
    const seen = new Set<EmailId>()

    for (const query of queries) {
      let fullQuery = query
      if (opts?.since) {
        const afterDate = opts.since.toISOString().split("T")[0]
        fullQuery = `${query} after:${afterDate}`
      }

      let pageToken: string | undefined

      do {
        const res = await this.gmail.users.messages.list({
          userId: "me",
          q: fullQuery,
          pageToken,
          maxResults: 100,
        })

        for (const msg of res.data.messages ?? []) {
          if (msg.id && !seen.has(msg.id)) {
            seen.add(msg.id)
            yield msg.id
          }
        }

        pageToken = res.data.nextPageToken ?? undefined
      } while (pageToken)
    }
  }

  async *fetch(ids: AsyncIterable<EmailId>): AsyncIterable<Email> {
    if (!this.gmail) throw new Error("not authorized")

    for await (const id of ids) {
      const msg = await this.gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      })

      const headers = msg.data.payload?.headers ?? []
      const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")
      const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")
      const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")

      let date = new Date()
      if (dateHeader?.value) {
        try {
          date = new Date(dateHeader.value)
        } catch {}
      }

      const fromRaw = fromHeader?.value ?? "unknown"
      const from = fromRaw.match(/<(.+?)>/)?.[1] ?? fromRaw

      const attachments: AttachmentMeta[] = []
      this.findAttachments(msg.data.payload?.parts ?? [], attachments)

      yield {
        id,
        date,
        from,
        subject: subjectHeader?.value ?? "",
        attachments,
      }
    }
  }

  private findAttachments(parts: gmail_v1.Schema$MessagePart[], result: AttachmentMeta[]): void {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const ext = path.extname(part.filename).toLowerCase()
        if (ALLOWED_EXTENSIONS.has(ext)) {
          result.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType ?? "application/octet-stream",
          })
        }
      }
      if (part.parts) {
        this.findAttachments(part.parts, result)
      }
    }
  }

  async downloadAttachment(emailId: EmailId, attachmentId: string): Promise<Uint8Array> {
    if (!this.gmail) throw new Error("not authorized")

    const attachment = await this.gmail.users.messages.attachments.get({
      userId: "me",
      messageId: emailId,
      id: attachmentId,
    })

    if (!attachment.data.data) {
      throw new Error(`no data for attachment ${attachmentId}`)
    }

    return Uint8Array.from(Buffer.from(attachment.data.data, "base64"))
  }
}
