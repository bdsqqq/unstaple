export type EmailId = string

export type AttachmentMeta = {
  id: string
  filename: string
  mimeType: string
}

export type Email = {
  id: EmailId
  date: Date
  from: string
  subject: string
  attachments: AttachmentMeta[]
}

export type Attachment = AttachmentMeta & {
  data: Uint8Array
}

export type AttachmentContext = {
  email: Email
  attachment: Attachment
  index: number
  total: number
  source: string
}

export type NamedAttachment = AttachmentContext & {
  generatedName: string
}

export type StoredFile = {
  path: string
  status: "written" | "skipped" | "renamed"
}

export type Hooks<T> = {
  onItem?: (item: T) => void | Promise<void>
  onBatch?: (items: T[]) => void | Promise<void>
  onComplete?: () => void | Promise<void>
}

export type DiscoverHooks = Hooks<EmailId> & {
  onCacheUpdate?: (ids: EmailId[]) => Promise<void>
}

export type FetchHooks = Hooks<Email> & {
  onCacheUpdate?: (emails: Email[]) => Promise<void>
}

export type DownloadHooks = Hooks<{ email: Email; attachment: Attachment }> & {
  onProgress?: (downloaded: number, total: number) => void
}

export type StoreHooks = Hooks<StoredFile> & {
  onCacheUpdate?: (file: StoredFile, meta: Email) => Promise<void>
}

export type RenameHooks = Hooks<StoredFile> & {
  onCacheUpdate?: (oldPath: string, newPath: string, meta: Email) => Promise<void>
}

export interface Filter {
  getQueries(): string[]
}

export interface NamingStrategy {
  generate(ctx: AttachmentContext): string
}

export interface StorageBackend {
  exists(filename: string): Promise<boolean>
  write(filename: string, data: Uint8Array): Promise<string>
  rename(oldPath: string, newPath: string): Promise<string>
  scan(pattern?: string): AsyncIterable<string>
}

export interface EmailSource {
  authorize(): Promise<void>
  discover(filter: Filter, opts?: { since?: Date }): AsyncIterable<EmailId>
  fetch(ids: AsyncIterable<EmailId>): AsyncIterable<Email>
  downloadAttachment(emailId: EmailId, attachmentId: string): Promise<Uint8Array>
}
