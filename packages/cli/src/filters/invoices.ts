import type { Filter } from "../types.js"

export class InvoiceFilter implements Filter {
  getQueries(): string[] {
    return [
      // content-based: subject keywords
      'has:attachment filename:pdf (subject:invoice OR subject:receipt OR subject:fatura OR subject:recibo OR subject:order OR subject:confirmation OR subject:pagamento OR subject:comprovante OR subject:"extrato combinado")',

      // sender-based: known vendors
      "has:attachment filename:pdf from:(fnac OR worten OR apple OR amazon OR uber OR wise OR n26 OR netflix OR spotify OR google OR microsoft OR adobe OR github OR vercel OR railway OR hetzner OR namecheap OR stripe OR paddle OR millennium)",
    ]
  }
}
