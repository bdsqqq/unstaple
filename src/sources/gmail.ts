import { authenticate } from "@google-cloud/local-auth"
import { google, gmail_v1 } from "googleapis"
import * as fs from "fs"
import * as path from "path"
import type { Email, EmailId, EmailSource, Filter, AttachmentMeta } from "../types.js"

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"])

export type GmailSourceConfig = {
  credentialsPath: string
  tokenPath: string
}

export class GmailSource implements EmailSource {
  private gmail: gmail_v1.Gmail | null = null
  private config: GmailSourceConfig

  constructor(config: GmailSourceConfig) {
    this.config = config
  }

  async authorize(): Promise<void> {
    let auth

    if (fs.existsSync(this.config.tokenPath)) {
      const content = fs.readFileSync(this.config.tokenPath, "utf-8")
      const credentials = JSON.parse(content)
      auth = google.auth.fromJSON(credentials)
    } else {
      const client = await authenticate({
        scopes: SCOPES,
        keyfilePath: this.config.credentialsPath,
      })

      if (client.credentials) {
        const keys = JSON.parse(fs.readFileSync(this.config.credentialsPath, "utf-8"))
        const key = keys.installed || keys.web
        const payload = JSON.stringify({
          type: "authorized_user",
          client_id: key.client_id,
          client_secret: key.client_secret,
          refresh_token: client.credentials.refresh_token,
        })
        fs.writeFileSync(this.config.tokenPath, payload)
      }

      auth = client
    }

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
