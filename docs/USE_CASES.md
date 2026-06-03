# Agent-driven PIMA — use cases

What a scoped, agent-driven CLI unlocks. Three properties make these newly
possible:

- **Least-privilege scoped tokens per agent.** An agent gets exactly
  `customers:read + orders:write` — nothing else. The blast radius is the token.
- **Headless + cron + MCP.** Agents run on a schedule or in chat via
  `PIMA_TOKEN`; the CLI surface *is* the agent's toolset.
- **Attributable writes.** Every change records the OAuth token in PaperTrail
  `versions`, so you can audit exactly what an agent touched.

Agents also self-onboard: `pima skill data-model`, `pima skill order-routing`, …

## CX — customer experience
- **Returns concierge** — `orders:read`, `customers:read/write`. Looks up an
  order, issues store credit, reroutes/cancels lines. Can't touch products or
  pricing because it wasn't granted those scopes.
- **"Where's my order" deflection** — `orders:read`, `fulfillment:read`.
  Resolves status + tracking + fulfilling location, drafts the reply. Read-only,
  zero write risk by construction.
- **Proactive delay watcher** — `fulfillment:read`. Cron agent flags orders
  stuck >N days and drafts an apology + suggested credit for human approval.

## Ops — warehouse / fulfillment
- **Auto-reroute bot (flagship)** — `orders:read/write`, `inventory:read`.
  Nightly: read the routing dashboard, find unshippable items, check stock at
  alternates, reroute. `--dry-run` report → human approves, or autonomous within
  guardrails.
- **Transfer reconciliation** — `transfers:read/write`. A box doesn't scan at
  destination; the agent marks it missing/found and opens an investigation note.
- **Cycle-count planner** — `inventory:read`. Ranks SKUs by discrepancy risk
  (velocity vs on-hand) and proposes the day's count list.

## Accounting
- **Receiving reconciliation** — `purchasing:read/write`. Compares PO expected
  vs received qty/cost, auto-accepts clean POs, holds variances for review.
- **Credit-liability tracker** — `customers:read`. Tallies outstanding store
  credit + gift-card balances daily for the balance sheet.
- **Returns/refunds ledger** — `orders:read`. Exports categorized daily
  returns/refunds/credits to the bookkeeper — a `read_only` token, no new
  integration.

## Finance
- **Inventory valuation snapshot** — `inventory:read`, `reports:read`. Daily
  on-hand × cost by location/category into a valuation feed.
- **Sell-through & markdown signal** — `reports:read`, `pricing:write`. Computes
  sell-through by style, *proposes* markdowns (write-gated, human-approved).
- **Open-PO cash commitment** — `purchasing:read`. Projects committed spend from
  open POs for cash-flow planning.

## Reporting
- **Natural-language reporting via MCP** — "how many California Tees sold at
  Venice last week, and what's on-hand?" Claude/Codex calls `search` +
  `sku show` + report endpoints and answers in chat.
- **Morning digest** — `read_only`. Cron agent runs a battery of reads and posts
  a Slack digest: shipped, unshippables, low-stock, returns spike.
- **Anomaly detection** — `reports:read`. Diffs today's metrics vs trailing
  average, alerts when returns jump or ship-speed drops.

## Retail team management
- **Clock / coverage agent** — `admin:read`. Flags missing clock-outs, overtime,
  coverage gaps vs pickup/order volume per store.
- **Onboarding provisioning** — `admin:write` (narrow). Creates
  memberships/invites from an HR feed; `admin:write` is opt-in, off by default,
  and runs `--dry-run` first.
- **SOP / memo distribution** — `admin:write`. Pushes memos/assignments to store
  teams, tracks completion.
- **Associate coaching reports** — `reports:read`. Per-associate POS sales +
  fulfillment speed into a weekly summary.

## The pattern underneath

Give each agent a **named, scoped token** = a persona whose job description is
enforced by the server. A `read_only` cron bot can never mutate; a returns agent
can issue credits but not change prices; an ops bot can reroute but not touch
customers. Every action is logged to that token. That's the difference between
"an agent with your full login" and "an agent with a job."
