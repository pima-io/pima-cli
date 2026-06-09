---
name: getting-started
description: Orientation — auth, scopes, output modes, exit codes, and the read→write safety model
when_to_use: First time using the pima CLI, or wiring it into an agent
scopes: []
related: [scopes, data-model, feedback]
---

# Getting started with the PIMA CLI

The `pima` CLI is a thin client over PIMA's existing JSON API. It does not
implement business logic — it calls the same endpoints the PIMA web app uses,
authenticated with OAuth and scoped per domain.

## Authenticate (gh-style device flow)

```
pima auth login --host https://pima.io
```

This prints a one-time code, opens your browser to approve it, and **polls**
the server until you finish — no callback server, no pasting tokens. The token
is stored in your OS keychain, keyed by host.

- `pima auth login --read-only` requests the `read_only` preset (every
  `<domain>:read`) — the safe default for agents and reporting.
- `pima auth login --scopes orders:read,orders:write,inventory:read` requests
  exactly those scopes; you still approve them on the consent screen.
- `pima auth status` shows who you are and what scopes you hold.

## Headless / agent use

Set `PIMA_TOKEN` (a personal access token) and `PIMA_HOST` to skip the browser
flow entirely:

```
PIMA_HOST=https://pima.io PIMA_TOKEN=… pima orders list --json | jq '.[0]'
```

## Common reads

```
pima resources
pima resource describe orders
pima resource list orders --variant pos --filter completed_from=2026-06-08 --json
pima metrics sales --today --channel pos
```

## Output modes

Every read command supports three:

- default → human table
- `--json` → raw lean JSON (agent-native; pipe to `jq`)
- `--csv` → for list/report exports

The JSON is the **lean** payload: PIMA strips UI-only fields and returns
domain-shaped data plus `can_*` permission flags.

## The read→write safety model

- Read commands are always safe.
- Write commands (`reroute`, `adjust`, `accept`, `cancel`, …) require the
  matching `<domain>:write` scope. A read-only token gets a clean **exit code 3**
  (forbidden) instead of mutating anything.
- Write commands support `--dry-run` (print the request without sending) and
  require `--yes` (or an interactive confirm) before they execute.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | generic error |
| 3 | not authenticated / scope denied |
| 4 | not found |
| 5 | validation error |

## Going deeper

Run `pima skill` to list every skill. Start with `pima skill data-model` — it
explains the one naming trap that trips up almost everyone (the model names do
not match the labels you see in the UI).

Use `pima skill feedback` to learn when to file bugs, ask questions, or request
features from an agent session.
