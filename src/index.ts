import * as path from "path"
import { fileURLToPath } from "url"
import { GmailSource } from "./sources/index.js"
import { InvoiceFilter } from "./filters/index.js"
import { InvoiceNamingStrategy } from "./operations/index.js"
import { LocalStorage } from "./storage/index.js"
import { fullSync } from "./pipelines/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CREDENTIALS_PATH = path.join(
  __dirname,
  "../../2025-12-09 google cloud mbp-m2 sync invoice attachments client_secret_1030944683117-b2ksqdfvn7unk9ojr7tpeqv6l635hq7k.apps.googleusercontent.com.json"
)
const TOKEN_PATH = path.join(__dirname, "../token.json")
const OUTPUT_DIR = path.join(__dirname, "../../invoices")

async function main() {
  const command = process.argv[2] ?? "full-sync"

  const source = new GmailSource({
    credentialsPath: CREDENTIALS_PATH,
    tokenPath: TOKEN_PATH,
  })

  const filter = new InvoiceFilter()
  const naming = new InvoiceNamingStrategy()
  const storage = new LocalStorage(OUTPUT_DIR)

  switch (command) {
    case "full-sync":
      await fullSync({
        source,
        filter,
        naming,
        storage,
        sourceName: "gmail",
      })
      break

    default:
      console.log(`unknown command: ${command}`)
      console.log("available commands: full-sync")
      process.exit(1)
  }
}

main().catch(console.error)
