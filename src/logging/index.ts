import { Axiom } from "@axiomhq/js"
import { Logger, ConsoleTransport, AxiomJSTransport, type Transport } from "@axiomhq/logging"

export type Operation = "discover" | "fetch" | "download" | "store" | "rename" | "sync"

export type LogContext = {
  operation?: Operation
  emailId?: string
  attachmentId?: string
  filename?: string
  durationMs?: number
  count?: number
  source?: string
}

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LoggerConfig = {
  axiomToken?: string
  axiomDataset?: string
  logLevel?: LogLevel
  prettyPrint?: boolean
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    axiomToken = process.env.AXIOM_TOKEN,
    axiomDataset = process.env.AXIOM_DATASET,
    logLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info",
    prettyPrint = true,
  } = config

  const transports: Transport[] = [new ConsoleTransport({ logLevel, prettyPrint })]

  if (axiomToken && axiomDataset) {
    const axiom = new Axiom({ token: axiomToken })
    transports.push(
      new AxiomJSTransport({
        axiom,
        dataset: axiomDataset,
        logLevel,
      })
    )
  }

  return new Logger({ transports: transports as [Transport, ...Transport[]] })
}

export { Logger } from "@axiomhq/logging"
