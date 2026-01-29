import type { AttachmentContext, NamingStrategy } from "../types.js"

const GENERIC_PREFIXES = new Set([
  // english
  "noreply",
  "no-reply",
  "no_reply",
  "auto-confirm",
  "autoconfirm",
  "info",
  "support",
  "billing",
  "invoices",
  "invoice",
  "notifications",
  "notification",
  "alerts",
  "alert",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "mailer",
  "news",
  "newsletter",
  "updates",
  "orders",
  "order",
  "receipts",
  "receipt",
  "confirm",
  "confirmation",
  "hello",
  "contact",
  "team",
  "admin",
  "system",
  "service",
  "services",
  // portuguese
  "naoresponder",
  "nao-responder",
  "nao_responder",
  "naoresponda",
  "nao-responda",
  "semresposta",
  "sem-resposta",
  "faturacao",
  "faturacaoeletronica",
  "faturas",
  "fatura",
  "recibos",
  "recibo",
  "cobranca",
  "cobrancas",
  "pagamentos",
  "pagamento",
  "contato",
  "contacto",
  "atendimento",
  "comunicacao",
  "avisos",
  "aviso",
  // compound patterns (will match after normalization)
  "noreplyfaturaseletronicas",
  "faturaseletronicas",
])

const STRIP_SUBDOMAINS = new Set(["mail", "www", "app", "api", "smtp", "email", "e-mail"])

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100)
}

function extractPersonAndCompany(from: string): { person?: string; company: string } {
  // extract email from "Name <email@domain.com>" or plain "email@domain.com"
  const emailMatch = from.match(/<(.+?)>/)
  const email = emailMatch ? emailMatch[1] : from

  if (!email) return { company: "unknown" }

  const [localPart, domain] = email.split("@")
  if (!domain) return { company: sanitizeFilename(localPart ?? "unknown") }

  // extract company from domain
  const domainParts = domain.split(".")
  // remove TLDs (last 1-2 parts depending on ccTLD like .com.br)
  let companyPart = domainParts[0] ?? "unknown"

  // strip common subdomains
  if (STRIP_SUBDOMAINS.has(companyPart.toLowerCase()) && domainParts.length > 2) {
    companyPart = domainParts[1] ?? companyPart
  }

  const company = sanitizeFilename(companyPart.toLowerCase())

  // check if local part is generic
  const normalizedLocal = (localPart ?? "").toLowerCase().replace(/[._-]/g, "")
  if (GENERIC_PREFIXES.has(normalizedLocal) || GENERIC_PREFIXES.has(localPart?.toLowerCase() ?? "")) {
    return { company }
  }

  return {
    person: sanitizeFilename((localPart ?? "unknown").toLowerCase()),
    company,
  }
}

export class InvoiceNamingStrategy implements NamingStrategy {
  generate(ctx: AttachmentContext): string {
    const { email, attachment, index, total, source } = ctx

    // date
    const dateStr = email.date.toISOString().split("T")[0] ?? "unknown-date"

    // person + company
    const { person, company } = extractPersonAndCompany(email.from)
    const personCompany = person ? `${person} ${company}` : company

    // attachment name without extension
    const ext = attachment.filename.includes(".")
      ? attachment.filename.slice(attachment.filename.lastIndexOf("."))
      : ""
    const baseName = sanitizeFilename(
      attachment.filename.slice(0, attachment.filename.lastIndexOf(".") || undefined)
    )

    // compose: {date} {person} {company} {attachment-name} id_{emailId} {i}_of_{n} -- source__{source}.ext
    return `${dateStr} ${personCompany} ${baseName} id_${email.id} ${index}_of_${total} -- source__${source}${ext}`
  }
}

export function name(strategy: NamingStrategy, ctx: AttachmentContext): string {
  return strategy.generate(ctx)
}
