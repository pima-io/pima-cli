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
npm i -g @buckmason/pima-cli      # or: npx @buckmason/pima-cli
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

## Implementation plan

Phases (the server-side dependencies — Doorkeeper device-flow provider, scope
gates, lean header, `/oauth/scopes` — are tracked in the `pima` repo's
`docs/oauth_api_bridge_plan.md`).

- **A — Skeleton + transport.** oclif project, `Client` (fetch + `Authorization`
  + `X-Pima-View: lean` + typed errors), config (`~/.config/pima/config.json`,
  host resolution). ✅ scaffolded.
- **B — Auth.** `pima auth login|status|logout` via OAuth **device flow** (poll,
  no listener). Token in OS keychain (`keytar`); `PIMA_TOKEN` headless override.
  ✅ scaffolded.
- **C — Output contract.** table / `--json` / `--csv`; stable exit codes; errors
  to stderr. Shared `renderList(records, columns)` reads the lean payload's
  `columns`. ✅ scaffolded.
- **D — Read commands.** `orders list/show`, `order-item routing`, `sku
  show/inventory`, `inventory on-hand`, `transfer/po/shipment list/show`,
  `customer show`, `report run`, `search`. (Each maps 1:1 to an existing
  endpoint; server adds one `enforce_scope!(:"<domain>:read")`.)
- **E — Write commands.** ⭐ `order-item reroute` (scaffolded), then
  `order-item bulk-edit`, `order approve`, `transfer cancel`, `transfer-box
  set-missing/found`, `po accept/undo`, `inventory adjust`, `credit add` /
  `coupon apply`. `--dry-run`, `--yes`, prod guard.
- **F — Tests + DX.** vitest + nock (assert method/path/headers incl.
  `X-Pima-View`, and rendering). Shell completion, help ergonomics.
- **G — Agent + MCP.** Document the `PIMA_TOKEN` recipe; expose skills + verbs
  via an MCP presenter (same auth + endpoints).
- **H — Skills.** `pima skill` (scaffolded) + the skill catalog; lint that every
  command/scope referenced in a skill exists.

## License

MIT.
