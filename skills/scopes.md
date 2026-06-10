---
name: scopes
description: The OAuth scope taxonomy and how effective access is computed
when_to_use: When deciding what scopes to request, or debugging a 403
scopes: []
related: [getting-started, feedback]
---

# Scopes

PIMA uses GitHub-style scopes: `<domain>:<read|write>`. This skill mirrors the
server's taxonomy; the **live** source of truth is `GET /oauth/scopes` (rendered
by `pima skill scopes` when you're connected).

## The 11 domains

| Domain | read | write adds |
|---|---|---|
| `orders` | orders, routing, returns/refunds/exchanges | reroute, bulk-edit, approve/cancel, process returns |
| `inventory` | on-hand, units, bins, cycle counts, audits | adjust, stow/move, run counts, replenish |
| `transfers` | transfers, boxes, units, targets | create/accept/cancel, set box missing/found |
| `fulfillment` | shipments, pick/pack/batch, shipping config | pick/pack/weigh, accept/cancel shipments |
| `products` | item master, images, attributes | create/edit catalog, bulk edits, imports |
| `pricing` | coupons, price changes, sales plans | create/apply coupons, run price changes |
| `purchasing` | purchase orders, receiving status | create/accept/undo POs, edit costs |
| `customers` | customers, addresses, tags, credits | edit customers, add/adjust credits |
| `reports` | run/view/export reports, metrics | generate inventory reports, save layouts |
| `feedback` | submitted agent feedback status | file bugs, ask questions, request features |
| `admin` | company/location/user/role config | edit those + integrations, timesheets |

## Rules

1. **`write` includes `read`** for the same domain. Requesting `orders:write`
   gives you `orders:read` too.
2. **Effective access = granted scopes ∩ your PIMA ability ∩ your membership.**
   A scope can never let you do something the web UI wouldn't. If you have
   `admin:write` but your PIMA role can't edit locations, you still can't.
3. **`read_only`** is a consent-screen preset selecting every `<domain>:read` —
   the recommended default for agents.
4. The default on login (without `--scopes`) is the `read_only` preset (every
   `<domain>:read`) plus `feedback:write`, so agents can file bugs and ask
   questions out of the box. Any other `:write` scope must be requested
   explicitly; `--read-only` drops `feedback:write` too.

## Debugging a 403 (exit code 3)

- You're not authenticated → `pima auth login`.
- You're authenticated but missing the domain's `:write` (or `:read`) scope →
  re-run `pima auth login --scopes …` to widen, then re-approve.
- You have the scope but your PIMA role lacks the underlying ability → that's an
  abilities/permissions issue in PIMA itself, not a scope issue.
