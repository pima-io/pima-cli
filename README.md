# pima-cli

A command-line bridge to **PIMA** — for humans and AI agents (Codex, Claude
Code). OAuth device-flow auth, GitHub-style scopes, and built-in **skills** that
teach agents how the domain works.

It is a thin client over PIMA's existing JSON API. It implements **no** business
logic — it calls the same endpoints the PIMA web app uses, sending
`X-Pima-View: lean` so responses are domain-shaped, not UI-shaped.

## Install

```
npm i -g @pima-io/cli      # or: npx @pima-io/cli
```

## Quick start

```
pima auth login --read-only
pima orders list --status shippable
pima skill getting-started
```

`pima auth login` uses the **OAuth 2.0 device flow** (like `gh auth login`): it
shows a one-time code, opens your browser to approve it, and polls the server
until you finish. No callback server. The token lives in your OS keychain.

### Headless / agents

```
PIMA_TOKEN=… pima orders list --json | jq
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
(backfill: `inventory`, `fulfillment`, `purchasing`, `recipes`,
`question-catalog`, `versions`, `comments`, `feedback`).

## Discoverability

The server self-describes its full resource surface at
`GET /api_manifest.json`. The CLI fetches and caches it (24h) so you—or an
agent—can introspect before acting:

```
pima resources                  # every resource: id, domain, scopes, access (r/c/u/d), #fields/#filters/#actions
pima resources --domain orders  # filter to one domain
pima resource describe orders   # full contract: access, search/filters, create/update fields, actions, paths
pima resource link orders --filter status=shippable  # browser URL for a resource/filter context
pima resource export customers --q Dolph  # server-side CSV export, with filters/sort/view preserved
pima resource history order_items 12345   # PaperTrail history for a resource record
pima resource comments products 42        # comments + @-mention metadata
pima metrics sales --today --channel pos --city "Los Angeles"
pima metrics sales --today --channel pos --group-by location_group
pima metrics sales --today --location-group-id 12 --group-by location_group
pima metrics products --date 2026-06-06 --location-ids 12,34 --group-by style
pima metrics products --today --group-by product_type --location-group-by city
pima metrics team --today --group-by location_group --limit 3
pima metrics team --today --q tshirts --sort units --group-by all
pima inventory availability --sku BMSKUJY3 --short-name POS
pima inventory risk --q tshirts --city "Los Angeles" --channel pos --at-risk
pima inventory fulfillment --sku BMSKUJY3 --city "Los Angeles" --channel pos
pima inventory transfers --sku BMSKUJY3 --short-name POS --direction inbound
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

## Example questions

Run `pima skill question-catalog` for command mappings. Useful prompts include:

Saved location groups use Pima's actual `LocationGroup` model. Use
`--location-group`, `--location-group-id`, or `--location-group-ids` to select
those records, and `--group-by location_group` / `--location-group-by
location_group` to group by them. Use `--city`, `--state`, or `--group-by
city|state|location` for ad-hoc geographic rollups. `region` remains a legacy
alias for `location_group`.

**Sales / Store Health**

- "How are POS sales today by saved LocationGroup?"
- "Which California stores are underperforming today?"
- "Compare Los Angeles POS sales this week vs last week."
- "Which stores have the highest AOV today?"
- "Which store has the best sales per labor hour this week?"
- "Show me POS sales for SoHo and Nashville last Saturday."

**Product Performance**

- "What were the top selling styles in LA last Saturday?"
- "What SKUs drove the most revenue today?"
- "Which categories are returning the most this month?"
- "What are the top women's styles in California this week?"
- "What product types are selling best by city?"
- "Which SKU has the highest return rate in the last 30 days?"

**Team Performance**

- "Who were the top performing team members in each LocationGroup today?"
- "Who sold the most tshirts today?"
- "Who had the highest sales per hour this week?"
- "Who sold the most women's products in LA?"
- "Rank team members by units sold in Nashville last Saturday."
- "Which team members have high sales but low UPT?"

**Inventory**

- "How many white pima tees are on hand in SoHo?"
- "What tshirts are available in Los Angeles stores?"
- "Which stores are low on best-selling SKUs?"
- "What inventory is transferring into Nashville?"
- "Which SKUs are oversold or have negative sellable counts?"
- "Where can we fulfill this SKU from nearby?"

**Ops / Order Routing**

- "What shippable orders are blocked right now?"
- "Which unshippable items can be rerouted to another store?"
- "Show me the routing issues for SoHo."
- "Find orders stuck because inventory is pending transfer."

**Audit / Collaboration**

- "What changed on order item 12345?"
- "Show comments and @mentions on product 42."
- "Create a direct Pima link for the POS orders view filtered to today."
- "Export customers matching Dolph."
- "File feedback that the metrics endpoint should support sell-through by SKU."

**Compound**

- "Who sold the most tshirts today, broken down by LocationGroup, and are those stores low on those tshirts?"

## MCP server (conversational agents)

`pima mcp` runs an MCP server over stdio so Claude/Codex can drive PIMA in chat,
reusing your token's scopes. **Read-only by default**; `--write` exposes write
tools (still bounded by the token).

Tools: `pima_resources`, `pima_describe`, `pima_list`, `pima_show`,
`pima_fields`, `pima_search`, `pima_routing`, `pima_sales_summary`,
`pima_product_performance`, `pima_team_performance`, `pima_inventory_availability`,
`pima_inventory_risk`, `pima_inventory_fulfillment_recommendations`,
`pima_inventory_transfers`, `pima_report` — plus `pima_reroute`, `pima_create`,
`pima_update`, `pima_action`, and feedback tools with `--write`.
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
      "env": { "PIMA_TOKEN": "<token>" }
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
| `feedback` | file bugs, questions, feature requests |
| `admin` | company/location/user/role/integrations |

Full taxonomy: `pima skill scopes`.

## Output & exit codes

`--json` (lean JSON), `--csv` (exports), default human table. Exit codes:
`0` ok · `1` error · `3` auth/scope denied · `4` not found · `5` validation.
Write commands support `--dry-run` and require `--yes`. Dry-runs authenticate
and check the live manifest access/action before printing the request, but they
do not send the mutation.

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

## License

MIT.

Development note: `--host` and `PIMA_HOST` are only needed for local or
development PIMA instances. The production host is `https://pima.io`.
