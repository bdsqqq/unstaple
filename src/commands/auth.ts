import * as fs from "fs"
import { authenticate } from "@google-cloud/local-auth"
import { google } from "googleapis"
import {
  getCredentialsPath,
  getTokenPath,
  hasCredentials,
  hasToken,
  ensureConfigDir,
  saveToken,
  loadToken,
} from "../config/index.js"

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

export async function authCommand(args: string[]): Promise<void> {
  const subcommand = args[0]

  if (subcommand === "--status" || subcommand === "status") {
    await showStatus()
    return
  }

  if (subcommand === "--logout" || subcommand === "logout") {
    await logout()
    return
  }

  await runAuthFlow()
}

async function showStatus(): Promise<void> {
  const tokenPath = getTokenPath()
  const credentialsPath = getCredentialsPath()

  console.log(`config dir: ${ensureConfigDir()}`)
  console.log(`credentials: ${hasCredentials() ? "✓" : "✗"} ${credentialsPath}`)
  console.log(`token: ${hasToken() ? "✓" : "✗"} ${tokenPath}`)

  if (hasToken()) {
    try {
      const token = loadToken()
      if (token) {
        const auth = google.auth.fromJSON(token as any)
        const gmail = google.gmail({ version: "v1", auth: auth as any })
        const profile = await gmail.users.getProfile({ userId: "me" })
        console.log(`authenticated as: ${profile.data.emailAddress}`)
      }
    } catch {
      console.log("token exists but may be invalid")
    }
  }
}

async function logout(): Promise<void> {
  const tokenPath = getTokenPath()
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath)
    console.log("logged out (token removed)")
  } else {
    console.log("not authenticated")
  }
}

async function runAuthFlow(): Promise<void> {
  const credentialsPath = getCredentialsPath()

  if (!hasCredentials()) {
    console.error(`credentials not found: ${credentialsPath}`)
    console.error("")
    console.error("to set up authentication:")
    console.error("1. create a google cloud project")
    console.error("2. enable the gmail api")
    console.error("3. create oauth 2.0 credentials (desktop app)")
    console.error("4. download the json and save it to:")
    console.error(`   ${credentialsPath}`)
    console.error("")
    console.error("or set GMAIL_INVOICE_SYNC_CREDENTIALS_PATH to point to your credentials file")
    process.exit(1)
  }

  console.log("starting oauth flow...")
  console.log("a browser window will open. sign in and grant access.")

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  })

  if (!client.credentials?.refresh_token) {
    console.error("failed to obtain refresh token")
    process.exit(1)
  }

  const keys = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"))
  const key = keys.installed || keys.web

  const token = {
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  }

  saveToken(token)

  const gmail = google.gmail({ version: "v1", auth: client as any })
  const profile = await gmail.users.getProfile({ userId: "me" })

  console.log(`authenticated as: ${profile.data.emailAddress}`)
  console.log(`token saved to: ${getTokenPath()}`)
}
