import { GmailSource } from "./sources/index.js"
import { InvoiceFilter } from "./filters/index.js"
import { InvoiceNamingStrategy } from "./operations/index.js"
import { LocalStorage } from "./storage/index.js"
import { Cache } from "./cache/index.js"
import { createLogger } from "./logging/index.js"
import { loadConfig, ensureDataDir } from "./config/index.js"
import { authCommand } from "./commands/auth.js"
import { fullSync, incremental, renameFiles } from "./pipelines/index.js"

async function main() {
  const command = process.argv[2] ?? "sync"
  const args = process.argv.slice(3)

  if (command === "auth") {
    await authCommand(args)
    return
  }

  const config = loadConfig()
  const outputDir = config.outputDir
  ensureDataDir()

  const source = new GmailSource({ tokenPath: config.tokenPath })
  const filter = new InvoiceFilter()
  const naming = new InvoiceNamingStrategy()
  const storage = new LocalStorage(outputDir)
  const cache = new Cache(outputDir)
  const logger = createLogger()

  switch (command) {
    case "full-sync":
      await fullSync({
        source,
        filter,
        naming,
        storage,
        sourceName: "gmail",
        logger,
      })
      break

    case "sync":
      await incremental({
        source,
        filter,
        naming,
        storage,
        cache,
        sourceName: "gmail",
        logger,
      })
      break

    case "rename":
      await renameFiles({
        naming,
        storage,
        cache,
        sourceName: "gmail",
        logger,
      })
      break

    case "help":
    case "--help":
    case "-h":
      printHelp()
      break

    default:
      console.log(`unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

function printHelp() {
  console.log(`gmail-invoice-sync - extract invoice attachments from gmail

commands:
  auth            authenticate with gmail (opens browser)
  auth status     show authentication status
  auth logout     remove saved credentials
  sync            incremental sync (default)
  full-sync       full sync (re-fetch all)
  rename          rename existing files with current naming strategy
  help            show this help

environment variables:
  GMAIL_INVOICE_SYNC_TOKEN_PATH        path to token.json
  GMAIL_INVOICE_SYNC_CREDENTIALS_PATH  path to credentials.json
  GMAIL_INVOICE_SYNC_OUTPUT_DIR        output directory for invoices
  AXIOM_TOKEN                          axiom api token (for logging)
  AXIOM_DATASET                        axiom dataset name
  LOG_LEVEL                            debug|info|warn|error (default: info)
`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
