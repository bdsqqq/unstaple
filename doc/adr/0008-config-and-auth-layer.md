# 8. config and auth layer

date: 2026-01-29

## status

accepted

## context

previous design hardcoded paths relative to the source tree:
- `../../credentials.json` (oauth client secret)
- `../token.json` (refresh token)
- `../../invoices` (output directory)

this works for local development but fails for:
- open source distribution (paths don't exist on other machines)
- headless deployment (need env var overrides)
- nix packaging (binary has no concept of source tree)

lnr solved this with a layered config approach:
```
precedence: --flag > ENV_VAR > ~/.config/app/file
```

## decision

### xdg-compliant paths

```
~/.config/unstaple/
  credentials.json    # oauth client secret (user provides)
  token.json          # refresh token (auth command creates)

~/.local/share/unstaple/
  invoices/           # downloaded files
  .cache.json         # sync state
```

### environment variable overrides

| var | description |
|-----|-------------|
| `UNSTAPLE_TOKEN_PATH` | path to token.json |
| `UNSTAPLE_CREDENTIALS_PATH` | path to credentials.json |
| `UNSTAPLE_OUTPUT_DIR` | output directory |

for deployment: sops decrypts secrets to a path, service sets env var.

### auth command

```bash
unstaple auth           # run oauth flow, save token
unstaple auth status    # show current auth state
unstaple auth logout    # remove token
```

interactive auth happens once on a machine with a browser. for headless servers, copy the token or use env var pointing to sops-decrypted file.

### source simplification

`GmailSource` no longer runs the oauth flow inline. it expects a token to exist (via `auth` command or env var). this separates concerns:
- auth command: interactive oauth, token management
- source: read-only token consumer

## consequences

- works as standalone binary (no source tree dependency)
- open source friendly: `auth` command guides users through setup
- deployment friendly: env vars for all paths
- breaking: existing users need to move credentials to xdg paths or set env vars
