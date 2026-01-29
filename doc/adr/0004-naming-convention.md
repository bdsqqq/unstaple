# 4. filename naming convention

date: 2026-01-29

## status

accepted

## context

current format: `{date} {email-prefix} -- {attachment-name}.pdf`

problems:
- `auto-confirm` doesn't tell you it's amazon
- `noreply` is useless noise
- searching by vendor is hard
- no traceability to original email
- no indication of multi-attachment emails
- no source identification (for multi-source future)

## decision

new format:
```
{date} {person} {company} {attachment-name} id_{emailId} {i}_of_{n} -- source__gmail.pdf
```

components:
- `{date}` — ISO format (2024-03-15)
- `{person}` — extracted from local part, omitted if generic
- `{company}` — extracted from domain (without TLD)
- `{attachment-name}` — original filename (sanitized, without extension)
- `id_{emailId}` — gmail message ID for traceability
- `{i}_of_{n}` — attachment index (1_of_3 means first of three attachments)
- `-- source__gmail` — source identifier, enables multi-source (outlook, etc.)
- `.pdf` — original extension preserved

### examples

| from | attachment | email has | result |
|------|------------|-----------|--------|
| `auto-confirm@amazon.com` | `Order_123.pdf` | 1 attachment, id `abc123` | `2024-03-15 amazon Order_123 id_abc123 1_of_1 -- source__gmail.pdf` |
| `lourival@sistecon.com.br` | `invoice.pdf` | 2 attachments, id `xyz789` | `2024-03-15 lourival sistecon invoice id_xyz789 1_of_2 -- source__gmail.pdf` |
| `noreply@millennium.com` | `extrato.pdf` | 1 attachment, id `m111` | `2024-03-15 millennium extrato id_m111 1_of_1 -- source__gmail.pdf` |

### person extraction heuristic

if local part is generic, omit it:
- generic: `noreply`, `no-reply`, `auto-confirm`, `info`, `support`, `billing`, `invoices`, `notifications`, `alerts`, `donotreply`, `mailer-daemon`
- otherwise: include as person

### company extraction

- `amazon.com` → `amazon`
- `sistecon.com.br` → `sistecon`
- `mail.google.com` → `google` (strip common subdomains: mail, www, app, api)

## consequences

- existing files won't be renamed (would break references)
- new files use new convention
- search by vendor becomes trivial
- can trace any file back to original email via `id_{emailId}`
- multi-attachment emails are explicitly numbered
- future outlook/other sources distinguishable via `source__` suffix
