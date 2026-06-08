# pima-cli

A command-line bridge to **PIMA** — for humans and AI agents (Codex, Claude
Code). OAuth device-flow auth, GitHub-style scopes, and built-in **skills** that
teach agents how the domain works.

It is a thin client over PIMA's existing JSON API. It implements **no** business
logic — it calls the same endpoints the PIMA web app uses, sending
`X-Pima-View: lean` so responses are domain-shaped, not UI-shaped.

> Server side (OAuth provider, scopes, scope gates) lives in the private `pima`
> repo. See its `docs/oauth_api_bridge_plan.md`.

## Install

```
npm i -g @pima-io/cli      # or: npx @pima-io/cli
```

## Quick start

```
pima auth login --host https://your-pima-instance --read-only
pima orders list --status shippable
pima skill getting-started
```

`pima auth login` uses the **OAuth 2.0 device flow** (like `gh auth login`): it
shows a one-time code, opens your browser to approve it, and polls the server
until you finish. No callback server. The token lives in your OS keychain.

### Headless / agents

```
PIMA_HOST=https://your-pima-instance PIMA_TOKEN=… pima orders list --json | jq
```

## Skills vs. help

- `pima help` / `--help` → **syntax** (flags, args).
- `pima skill` → **understanding** (how a domain works, gotchas, recipes).

```
pima skill                 # list
pima skill data-model      # full text of one skill
pima skill --all           # everything, for an agent to slurp once
pima skill order-routing --json
```

v1 skills: `getting-started`, `data-model`, `order-routing`, `scopes`
(backfill: `inventory`, `fulfillment`, `purchasing`, `recipes`).

## Discoverability

The server self-describes its full resource surface at
`GET /api_manifest.json`. The CLI fetches and caches it (24h) so you—or an
agent—can introspect before acting:

```
pima resources                  # every resource: id, domain, scopes, access (r/c/u/d), #fields/#filters/#actions
pima resources --domain orders  # filter to one domain
pima resource describe orders   # full contract: access, search/filters, create/update fields, actions, paths
pima resource export customers --q Dolph  # server-side CSV export, with filters/sort/view preserved
pima skill resources            # live agent briefing rendered from the manifest, grouped by domain
```

The manifest is **gated**: the server filters it to the caller's ability ∩
token scopes, so inaccessible resources are simply absent and each resource
carries an `access` block (read/create/update/destroy) reflecting what your
token can actually do. The cache is keyed per token, so a re-login with
different scopes gets a fresh manifest automatically.

`resource describe` is the static manifest contract; `resource fields` is the
live create form. Over MCP this is `pima_resources` / `pima_describe` plus the
`manifest://resources` resource. Add `--refresh` to any of these to bypass the
cache.

## MCP server (conversational agents)

`pima mcp` runs an MCP server over stdio so Claude/Codex can drive PIMA in chat,
reusing your token's scopes. **Read-only by default**; `--write` exposes write
tools (still bounded by the token).

Tools: `pima_resources`, `pima_describe`, `pima_list`, `pima_show`,
`pima_fields`, `pima_search`, `pima_routing`, `pima_report` — plus
`pima_reroute`, `pima_create`, `pima_update`, `pima_action` with `--write`.
Skills are exposed as MCP resources (`skill://data-model`, …) and the full
surface as `manifest://resources`, so the agent introspects and reads the domain
model before acting.

Example client config (read-only):

```json
{
  "mcpServers": {
    "pima": {
      "command": "npx",
      "args": ["-y", "@pima-io/cli", "mcp"],
      "env": { "PIMA_HOST": "https://your-pima-instance", "PIMA_TOKEN": "<token>" }
    }
  }
}
```

For write access add `"--write"` to `args` and use a token holding the needed
`:write` scopes.

## Scopes

GitHub-style `<domain>:<read|write>`. `write` includes `read`. Effective access
= granted scopes ∩ your PIMA ability ∩ membership. `read_only` preset =
every `<domain>:read`. Live source of truth: `GET /oauth/scopes`.

| Domain | write enables (examples) |
|---|---|
| `orders` | reroute items, bulk-edit, approve/cancel, returns |
| `inventory` | adjust, stow, cycle counts, replenish |
| `transfers` | create/accept/cancel, box missing/found |
| `fulfillment` | pick/pack/weigh, ship accept/cancel |
| `products` | edit catalog, bulk edits, imports |
| `pricing` | coupons, price changes, sales plans |
| `purchasing` | create/accept/undo POs, costs |
| `customers` | edit customers, credits |
| `reports` | generate reports, save layouts |
| `admin` | company/location/user/role/integrations |

Full taxonomy: `pima skill scopes`.

## Output & exit codes

`--json` (lean JSON), `--csv` (exports), default human table. Exit codes:
`0` ok · `1` error · `3` auth/scope denied · `4` not found · `5` validation.
Write commands support `--dry-run` and require `--yes`.

## Develop

```
npm install
npm run build
./bin/dev.js auth status        # run without building
npm test
```

Commands live in `src/commands/<topic>/<cmd>.ts` (oclif). Shared transport,
auth, output, and skills loaders are in `src/lib/`. Skills are markdown in
`skills/`.

---

## Status

Implemented: OAuth device-flow auth, read + write commands, the generic
resource layer (every PIMA catalog resource), manifest-based discovery, the MCP
server, and the skills catalog. Server-side dependencies (Doorkeeper
device-flow provider, scope gates, lean header, `/oauth/scopes`,
`/api_manifest.json` gating) live in the private `pima` repo's
`docs/oauth_api_bridge_plan.md`.

The live surface is self-describing — run `pima skill` for the onboarding menu
and `pima resources` / `pima resource describe <name>` for the current resource
contract rather than relying on this README.

## License

MIT.
