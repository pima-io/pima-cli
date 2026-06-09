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

- `pima inventory availability` is the first choice for on-hand, available,
  sellable, inbound transfer, and projected availability questions. It resolves
  SKUs by SKU/UPC/product/category/gender and resolves locations by id, name,
  short name, Pima `LocationGroup` (`--location-group`,
  `--location-group-id`, `--location-group-ids`), city, state, channel, or
  `--all-pos`.
- `pima inventory transfers` is the first choice for "what is transferring",
  inbound/outbound transfer, and pending transfer questions. It groups rows by
  transfer and SKU and includes React UI drill-down links in `--json`.
- `pima inventory risk` is the first choice for "fast sellers that are low on
  stock", "best-selling SKUs almost out", and days-of-cover questions. It
  combines current sellable/projected availability with recent SKU sales
  velocity. Use `--at-risk` to return only high/medium risk rows.
- `pima inventory fulfillment` is the first choice for "where can this SKU be
  fulfilled from?" It ranks locations by sellable/projected stock and includes
  route eligibility plus route-action metadata for order items in `--json`.
- `pima sku show <id-or-name>` returns SKU master data and detail. Use it when
  you need the SKU record itself; use `inventory availability` for counts.
- `pima resource list units --q <SKU>` lists units (filterable).

Prefer the optimized inventory commands over paging raw units. Use raw units
only when you need serial-level inspection.

## Transfer-aware counts

`inventory availability` returns one row per SKU/location:

| field | meaning |
|---|---|
| `available` | physical units with `status: available` at the location |
| `sellable` | available units that are not blocked by bin/order constraints |
| `pending_transfer` | units at the location committed to a transfer |
| `transfering` | units currently transferring out from the location |
| `inbound_transfering` | units currently transferring in to the location |
| `projected_available` | `available + inbound_transfering` |
| `future_available` | `available + inbound_transfering + inbound_pending` |
| `locked_in_error` | available units with an active unit lock |
| `bin_location_mismatch` | units whose bin belongs to a different location |

Examples:

```sh
pima inventory availability --sku BMSKUJY3 --short-name POS
pima inventory availability --product "Field Spec" --city "Los Angeles" --channel pos
pima inventory availability --category Shirts --state CA --all-pos --json
pima inventory risk --q tshirts --city "Los Angeles" --channel pos --at-risk
pima inventory fulfillment --sku BMSKUJY3 --city "Los Angeles" --channel pos
pima inventory transfers --sku BMSKUJY3 --short-name POS --direction inbound --status transfering
```

## Changing it

Adjustments, stows, cycle counts, and replenishments require `inventory:write`.
They always reference a location and (usually) a reason. Prefer the dashboard
for large physical counts; use the CLI for targeted corrections. A read-only
token gets exit code 3 on any of these.
