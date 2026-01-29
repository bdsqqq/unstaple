import { authenticate } from "@google-cloud/local-auth";
import { google, gmail_v1 } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const CREDENTIALS_PATH = path.join(
  __dirname,
  "../../2025-12-09 google cloud mbp-m2 sync invoice attachments client_secret_1030944683117-b2ksqdfvn7unk9ojr7tpeqv6l635hq7k.apps.googleusercontent.com.json"
);
const TOKEN_PATH = path.join(__dirname, "../token.json");
const OUTPUT_DIR = path.join(__dirname, "../../invoices");

const SEARCH_QUERIES = [
  "has:attachment filename:pdf (subject:invoice OR subject:receipt OR subject:fatura OR subject:recibo OR subject:order OR subject:confirmation OR subject:pagamento OR subject:comprovante)",
  "has:attachment filename:pdf from:(fnac OR worten OR apple OR amazon OR uber OR wise OR n26 OR netflix OR spotify OR google OR microsoft OR adobe OR github OR vercel OR railway OR hetzner OR namecheap OR stripe OR paddle)",
];

async function authorize() {
  if (fs.existsSync(TOKEN_PATH)) {
    const content = fs.readFileSync(TOKEN_PATH, "utf-8");
    const credentials = JSON.parse(content);
    const auth = google.auth.fromJSON(credentials);
    return auth as any;
  }

  const client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    const keys = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    });
    fs.writeFileSync(TOKEN_PATH, payload);
  }

  return client;
}

async function getMessages(gmail: gmail_v1.Gmail, query: string) {
  const messages: gmail_v1.Schema$Message[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: query,
      pageToken,
      maxResults: 100,
    });

    if (res.data.messages) {
      messages.push(...res.data.messages);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return messages;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 100);
}

async function downloadAttachments(
  gmail: gmail_v1.Gmail,
  messageId: string,
  outputDir: string
) {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = msg.data.payload?.headers ?? [];
  const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date");
  const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from");
  const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject");

  let dateStr = "unknown-date";
  if (dateHeader?.value) {
    try {
      const date = new Date(dateHeader.value);
      dateStr = date.toISOString().split("T")[0];
    } catch {}
  }

  const from = fromHeader?.value?.match(/<(.+?)>/)?.[1] ?? fromHeader?.value ?? "unknown";
  const fromClean = sanitizeFilename(from.split("@")[0]);
  const subject = sanitizeFilename(subjectHeader?.value ?? "no-subject");

  const parts = msg.data.payload?.parts ?? [];
  const attachments: { filename: string; attachmentId: string }[] = [];

  function findAttachments(parts: gmail_v1.Schema$MessagePart[]) {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const ext = path.extname(part.filename).toLowerCase();
        if ([".pdf", ".png", ".jpg", ".jpeg"].includes(ext)) {
          attachments.push({
            filename: part.filename,
            attachmentId: part.body.attachmentId,
          });
        }
      }
      if (part.parts) {
        findAttachments(part.parts);
      }
    }
  }

  findAttachments(parts);

  for (const att of attachments) {
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: att.attachmentId,
    });

    if (attachment.data.data) {
      const buffer = Buffer.from(attachment.data.data, "base64");
      const ext = path.extname(att.filename);
      const basename = path.basename(att.filename, ext);
      const filename = `${dateStr} ${fromClean} -- ${sanitizeFilename(basename)}${ext}`;
      const filepath = path.join(outputDir, filename);

      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, buffer);
        console.log(`✓ ${filename}`);
      } else {
        console.log(`· ${filename} (exists)`);
      }
    }
  }
}

async function main() {
  console.log("authenticating...");
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("searching for invoices...\n");

  const allMessageIds = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    const messages = await getMessages(gmail, query);
    for (const m of messages) {
      if (m.id) allMessageIds.add(m.id);
    }
  }

  console.log(`found ${allMessageIds.size} emails with potential invoices\n`);

  let i = 0;
  for (const messageId of allMessageIds) {
    i++;
    process.stdout.write(`\r[${i}/${allMessageIds.size}] processing...`);
    try {
      await downloadAttachments(gmail, messageId, OUTPUT_DIR);
    } catch (err) {
      console.error(`\nerror processing ${messageId}:`, err);
    }
  }

  console.log("\n\ndone!");
}

main().catch(console.error);
