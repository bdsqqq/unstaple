import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const APP_NAME = "gmail-invoice-sync"

export type Config = {
  tokenPath: string
  credentialsPath: string
  outputDir: string
}

function getConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME
  if (xdgConfig) {
    return path.join(xdgConfig, APP_NAME)
  }
  return path.join(os.homedir(), ".config", APP_NAME)
}

function getDataDir(): string {
  const xdgData = process.env.XDG_DATA_HOME
  if (xdgData) {
    return path.join(xdgData, APP_NAME)
  }
  return path.join(os.homedir(), ".local", "share", APP_NAME)
}

export function ensureConfigDir(): string {
  const dir = getConfigDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function ensureDataDir(): string {
  const dir = getDataDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getTokenPath(): string {
  return process.env.GMAIL_INVOICE_SYNC_TOKEN_PATH ?? path.join(getConfigDir(), "token.json")
}

export function getCredentialsPath(): string {
  return process.env.GMAIL_INVOICE_SYNC_CREDENTIALS_PATH ?? path.join(getConfigDir(), "credentials.json")
}

export function getOutputDir(): string {
  return process.env.GMAIL_INVOICE_SYNC_OUTPUT_DIR ?? path.join(getDataDir(), "invoices")
}

export function hasToken(): boolean {
  return fs.existsSync(getTokenPath())
}

export function hasCredentials(): boolean {
  return fs.existsSync(getCredentialsPath())
}

export function loadConfig(): Config {
  return {
    tokenPath: getTokenPath(),
    credentialsPath: getCredentialsPath(),
    outputDir: getOutputDir(),
  }
}

export function saveToken(token: object): void {
  ensureConfigDir()
  fs.writeFileSync(getTokenPath(), JSON.stringify(token, null, 2))
}

export function loadToken(): object | null {
  const tokenPath = getTokenPath()
  if (!fs.existsSync(tokenPath)) {
    return null
  }
  return JSON.parse(fs.readFileSync(tokenPath, "utf-8"))
}

export { APP_NAME }
