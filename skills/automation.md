---
name: automation
description: The full capability map — what an agent can read/write, which command, which scope
when_to_use: When planning a multi-step automation or figuring out which command does X
scopes: []
related: [getting-started, scopes, recipes, order-routing, inventory, purchasing]
---

# Automation capability map

This is the master reference for what the CLI can do. Two layers:

1. **Named commands** for the highest-traffic operations (orders, routing,
   reroute, PO accept/undo, transfers, shipments, search, credit, reports).
2. **The generic resource layer** — which covers *every* PIMA catalog resource
   (90+), so you're never blocked waiting for a dedicated command.

Everything is bounded by your token's scopes (writes need `<domain>:write`) AND
your PIMA role. Every write is attributed to your token in the audit trail.

## Discoverability — find the surface first

Don't guess what exists. The server self-describes via `GET /api_manifest.json`,
surfaced as:

```sh
pima resources                       # every resource: id, domain, scopes, #fields/#filters/#actions
pima resources --domain orders       # filter to one domain
pima resource describe <name>        # full contract: search/filter params, create/update fields, actions, paths
pima skill resources                 # LIVE agent briefing rendered from the manifest, grouped by domain
```

`resource describe` is the static contract from the manifest (what the resource
*is*); `resource fields` is the live create form (what the server *currently*
accepts). Over MCP the same introspection is `pima_resources` (list) and
`pima_describe` (one resource), plus the `manifest://resources` resource. Lead
with these before `pima_list` / `pima_create`.

## The generic resource layer (the big unlock)

Any catalog resource — `coupons`, `customer_credits`, `invites`, `memos`,
`memo_assignments`, `cycle_counts`, `inventory_audits`, `order_returns`,
`bulk_price_changes`, `sales_plans`, `vendors`, … — supports:

```sh
pima resource list <name> [--q --page --variant]      # read    (<domain>:read)
pima resource show <name> <id>                         # read    (<domain>:read)
pima resource fields <name>                            # the create form schema
pima resource create <name> --data '{...}' --yes       # write   (<domain>:write)
pima resource update <name> <id> --data '{...}' --yes  # write   (<domain>:write)
pima resource delete <name> <id> --yes                 # write   (<domain>:write)
pima resource action <name> <id> <verb> [--method]     # member action (e.g. accept)
pima resource export <name> [--q --filter --variant]   # server-side CSV export
```

`resource fields <name>` tells you exactly what keys `--data` expects, so you
don't have to guess. `--data` is the record's fields (the CLI wraps them as
`{record: {...}}` for you).

## Capability map by use case

| You want to… | Command | Scope |
|---|---|---|
| Look up an order + its routing | `orders show`, `order-item routing` | `orders:read` |
| Reroute an item to another location | `order-item reroute <id> --to <loc>` | `orders:write` |
| Process a return | `resource create order_returns --data '{...}'` | `orders:write` |
| Issue store credit | `credit add --customer <id> --amount <n>` | `customers:write` |
| Look up a customer + credit balance | `customer show <id>` | `customers:read` |
| See on-hand for a SKU (by location) | `inventory availability --sku <sku>` | `inventory:read` |
| List units (inventory) | `resource list units --q <SKU>` | `inventory:read` |
| Adjust inventory | `resource create inventory_audits --data '{...}'` (+ audit skus) | `inventory:write` |
| Plan / start a cycle count | `resource create cycle_counts --data '{"location_id":7}'` | `inventory:write` |
| Receive / undo a purchase order | `po accept <id>` / `po undo <id>` | `purchasing:write` |
| Reconcile a transfer box | `transfer-box set-missing/set-found <id>` | `transfers:write` |
| Create a coupon / markdown | `resource create coupons --data '{...}'` / `bulk_price_changes` | `pricing:write` |
| Fetch a legacy report payload | `report get <name> [--param k=v]` | `reports:read` |
| Search pages and records | `search "<query>"` | `reports:read` |
| Invite a teammate | `resource create invites --data '{...}'` | `admin:write` |
| Push a memo / SOP | `resource create memo_assignments --data '{...}'` | `admin:write` |
| Read timesheets / clocks | `resource list timesheets` / `clocks` | `admin:read` |

## What a token CANNOT do (the clock-in boundary)

POS-session and warehouse-station actions require a **clocked-in location** that
a token doesn't carry: POS cart edits, item cancellation that opens a location
return, pick/pack/scan workflows. These live in a different session by design.
Use the session-independent equivalents instead:

- Reroute an item → `order-item reroute` (not the POS cart endpoint).
- Move inventory between locations → transfers (`transfers` domain), not a POS
  adjust.

If an action 422s asking you to "clock in," it's session-bound — find the
API-shaped equivalent or hand it to a human at a station.

## Conversational use (MCP)

`pima mcp` exposes these capabilities as MCP tools so an agent can drive PIMA in
chat. Read tools (`pima_resources`, `pima_describe`, `pima_list`, `pima_show`,
`pima_fields`, `pima_search`, `pima_routing`, `pima_report`) are always on; write
tools (`pima_reroute`, `pima_create`, `pima_update`, `pima_action`) require
`--write`. Every skill is also an MCP resource (`skill://<name>`) and the full
surface is `manifest://resources` — introspect with `pima_resources` /
`pima_describe`, then read `skill://data-model`. The connected token's scopes
bound everything, exactly as on the CLI.

## Designing an automation

1. Decide the **minimum scopes** the job needs and request exactly those
   (`pima auth login --scopes ...`). A reporting job is `read_only`; a returns
   job is `orders:read + customers:write + orders:write`.
2. Prefer named commands; fall back to `resource ...` for anything else.
3. `--dry-run` every write first; require human approval for refunds, credit,
   markdowns, and `admin:write`.
4. Pipe `--json` to `jq` to chain steps.
5. Everything you write is logged to your token — that's the audit trail.
