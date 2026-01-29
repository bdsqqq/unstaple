import * as fs from "fs"
import * as path from "path"
import type { Email, EmailId } from "../types.js"

/**
 * persists sync state between runs. enables incremental sync (skip already-processed emails)
 * and rename operations (apply new naming without re-fetching metadata).
 *
 * stored as JSON for simplicity and debuggability. if mailbox grows to millions of emails
 * and perf becomes an issue, migrate to sqlite.
 */

type CacheData = {
  lastSync: string | null
  emails: Record<EmailId, Email & { date: string }>
  files: Record<string, string> // `${emailId}:${attachmentId}` → filePath
}

export class Cache {
  private cachePath: string
  private data: CacheData = {
    lastSync: null,
    emails: {},
    files: {},
  }
  private dirty = false

  constructor(baseDir: string) {
    const cacheDir = path.join(baseDir, ".gmail-invoice-sync")
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true })
    }
    this.cachePath = path.join(cacheDir, "cache.json")
  }

  async load(): Promise<void> {
    if (!fs.existsSync(this.cachePath)) return

    try {
      const raw = fs.readFileSync(this.cachePath, "utf-8")
      this.data = JSON.parse(raw)
    } catch {
      // corrupted cache — start fresh
      this.data = { lastSync: null, emails: {}, files: {} }
    }
  }

  async flush(): Promise<void> {
    if (!this.dirty) return
    fs.writeFileSync(this.cachePath, JSON.stringify(this.data, null, 2))
    this.dirty = false
  }

  getLastSync(): Date | null {
    return this.data.lastSync ? new Date(this.data.lastSync) : null
  }

  setLastSync(date: Date): void {
    this.data.lastSync = date.toISOString()
    this.dirty = true
  }

  getEmail(id: EmailId): Email | null {
    const cached = this.data.emails[id]
    if (!cached) return null
    return { ...cached, date: new Date(cached.date) }
  }

  setEmail(email: Email): void {
    this.data.emails[email.id] = {
      ...email,
      date: email.date.toISOString(),
    } as Email & { date: string }
    this.dirty = true
  }

  getAllEmails(): Email[] {
    return Object.values(this.data.emails).map((e) => ({
      ...e,
      date: new Date(e.date),
    }))
  }

  /**
   * composite key because one email can have multiple attachments.
   * format: `${emailId}:${attachmentId}`
   */
  private fileKey(emailId: EmailId, attachmentId: string): string {
    return `${emailId}:${attachmentId}`
  }

  getFilePath(emailId: EmailId, attachmentId: string): string | null {
    return this.data.files[this.fileKey(emailId, attachmentId)] ?? null
  }

  setFilePath(emailId: EmailId, attachmentId: string, filePath: string): void {
    this.data.files[this.fileKey(emailId, attachmentId)] = filePath
    this.dirty = true
  }

  getAllFilePaths(): Array<{ emailId: EmailId; attachmentId: string; path: string }> {
    return Object.entries(this.data.files).map(([key, filePath]) => {
      const [emailId, attachmentId] = key.split(":")
      return { emailId: emailId ?? "", attachmentId: attachmentId ?? "", path: filePath }
    })
  }

  /**
   * number of cached emails. useful for progress reporting.
   */
  get emailCount(): number {
    return Object.keys(this.data.emails).length
  }

  get fileCount(): number {
    return Object.keys(this.data.files).length
  }
}
