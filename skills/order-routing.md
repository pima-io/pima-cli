---
name: order-routing
description: How order-item fulfillment routing works and how to reroute safely
when_to_use: Before `pima order-item reroute` or reading the routing dashboard
scopes: [orders:read, orders:write]
related: [data-model, fulfillment]
---

# Order routing

## The mental model

Every order item has a **fulfillment location** — the store or warehouse that is
supposed to ship (or hand off) that item. PIMA assigns one automatically based
on inventory availability, but it can be wrong: inventory shifts, a location
runs out, an item is unshippable from where it was routed.

**Rerouting** = changing an order item's fulfillment location so a different
location ships it. It does not move physical inventory; it reassigns
responsibility for that line.

## When to reroute

- An item is stuck "unshippable" at its current location (no available units).
- You want to consolidate an order to fewer locations.
- A location is over capacity and you're load-balancing.

## Reading the picture first

```
pima order-item routing --location 7
```

This is the routing dashboard for a location: items routed there and their
shippability. Always look before you reroute — confirm the destination actually
has available units (`pima sku inventory <name>`), because rerouting to a
location without stock just moves the problem.

## Rerouting

Single item (the flagship command):

```
pima order-item reroute 12345 --to 7 --dry-run   # preview the request
pima order-item reroute 12345 --to 7 --yes        # execute
```

- `--dry-run` prints the exact PATCH it would send, without touching anything.
- `--yes` is required to execute (otherwise it stops and asks).
- Requires the `orders:write` scope. A read-only token gets exit code 3.

Bulk reroute (multiple items at once) maps to the order's bulk-edit endpoint —
prefer it when shifting many items on one order so the order recomputes once.

## What happens server-side

The CLI calls the existing PIMA endpoint that updates the item's
`fulfillment_location`; PIMA re-runs its ability checks and recomputes order
shippability. The same action a warehouse user takes in the web UI — the CLI is
just another front door to it.

## Gotchas

- Routing is about *order items*, not whole orders — a single order can have
  items at several locations.
- Rerouting to a location with no available units will route it but leave it
  unshippable. Check inventory first.
