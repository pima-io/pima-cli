---
name: inventory
description: On-hand vs available, the unit lifecycle, bins, and adjustments
when_to_use: Before reading inventory numbers or adjusting stock
scopes: [inventory:read, inventory:write]
related: [data-model, fulfillment]
---

# Inventory

## On-hand vs. available

These are different questions:

- **Available** = units with `status: 'available'` — sellable right now.
- **On-hand** = all units physically present, which can include non-sellable
  statuses (`damaged`, `pending_transfer`, `pending_shipment`, `missing`).

When someone asks "how many do we have," clarify which they mean. For "can we
sell it," use available.

## The unit lifecycle

A `Unit` is one physical item; its `status` is the source of truth:

| status | sellable? | meaning |
|---|---|---|
| `available` | yes | on the floor / in a bin, ready |
| `damaged` | no | pulled from sellable stock |
| `sold` | no | already sold |
| `pending_transfer` | no | committed to a transfer |
| `pending_shipment` | no | committed to a shipment |
| `missing` | no | unaccounted for |

Inventory is almost always **per location** — a SKU has different counts at
each store/warehouse.

## Seeing it

- `pima sku show <id>` returns a SKU's detail including its per-location
  inventory.
- `pima resource list units --q <SKU>` lists units (filterable).

## Changing it

Adjustments, stows, cycle counts, and replenishments require `inventory:write`.
They always reference a location and (usually) a reason. Prefer the dashboard
for large physical counts; use the CLI for targeted corrections. A read-only
token gets exit code 3 on any of these.
