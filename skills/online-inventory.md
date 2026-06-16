---
name: online-inventory
description: Online sellable inventory, fulfillable availability, routing eligibility, and the settings that connect them
when_to_use: When explaining ecommerce availability, ship/pickup fulfillment, SFS routing, or inventory threshold settings
scopes: [inventory:read, products:read, orders:read]
related: [inventory, fulfillment, order-routing, resources]
---

# Online sellable and fulfillable inventory

PIMA separates **whether inventory can be sold online** from **where an order
can be fulfilled**. A location can contribute inventory to ecommerce
availability without being eligible for automatic order routing.

## Start with three concepts

- **Sellable online**: Inventory can count toward ecommerce availability.
- **Fulfillable**: The storefront/PIMA availability logic believes the item can
  be shipped or picked up.
- **Routing enabled**: PIMA may automatically assign ecommerce order items to
  this location after the order lands.

These settings are related, but they are not the same. Do not assume a
sellable-online location can receive automatic SFS work.

## Company settings

Use `pima resource link companies 1` or open:

```text
https://pima.io/app/companies/1/edit
```

Important fields:

| field | meaning |
|---|---|
| `all_products_sellable_online` | Ecommerce sellable count can include all locations marked sellable online. |
| `enable_all_location_sellable_online` | Allows product-level all-location sellable online behavior. |
| `retail_inventory_threshold` | Per-store keep-back for POS locations. If blank, treat it as zero. |
| `all_retail_safety_inventory_threshold` | Aggregate keep-back across the retail pool for multi-location ecommerce/fulfillment availability. |
| `auto_routing_enabled` | Whether completed eligible ecommerce orders auto-route. |
| `auto_routing_threshold` | Minimum sellable units required at a candidate location before routing there. |

## Location settings

Use `pima resource link locations <id>` or open:

```text
https://pima.io/app/locations
```

Important fields:

| field | meaning |
|---|---|
| `sellable_online` | Location inventory can contribute to ecommerce sellable availability. |
| `enable_store_ship` | Location participates in ship-from-store availability/fulfillment checks. |
| `routing_enabled` | Location is eligible for automatic order-item routing. |
| `always_auto_route` | Routing checks this location first when it has enough sellable inventory. |
| `override_inventory_threshold` | Use this location's `inventory_threshold` instead of company retail threshold. |
| `inventory_threshold` | Location-specific retail keep-back. |
| `omit_all_retail_safety_inventory_threshold` | Exclude this location from all-retail safety behavior where applicable. |

Example: a store with `sellable_online: true` and `routing_enabled: false`
can make a SKU appear available online, but PIMA will not auto-route an
ecommerce order item to that store.

## Product and SKU settings

Use:

```sh
pima resource link products <id>
pima resource link skus <id>
```

Important fields:

| record | field | meaning |
|---|---|---|
| Product | `all_locations_sellable_online` | Product may use all sellable-online locations when company settings allow it. |
| Product | `all_locations_sellable_online_always` | Forces all-location sellable behavior independent of the normal company toggle. |
| Product | `oos_threshold` | Product-level out-of-stock buffer subtracted from sellable count. |
| SKU | `oos_threshold` | SKU-level out-of-stock buffer; wins over product `oos_threshold` when present. |
| Product | `include_transferring_in_sellable` | Transfering units can count toward sellable availability for this product. |

## Sellable count mental model

High-level formula:

```text
online sellable = available inventory - retail buffers - OOS buffers - open demand
```

Details:

- Units generally count only when `status = available`.
- Units in bins disabled for selling are excluded.
- Transfering inventory counts only for products with
  `include_transferring_in_sellable`.
- POS locations can lose units to `retail_inventory_threshold` or a
  location-specific `inventory_threshold`.
- Multi-location retail pools can lose units to
  `all_retail_safety_inventory_threshold`.
- Product/SKU `oos_threshold` subtracts another buffer.
- Open new/routed order items and pending shipments without units reduce
  sellable count, because already-promised demand consumes availability.

Use `pima inventory availability --json` for the best CLI read on available,
sellable, projected, and transfer-aware counts. Avoid reconstructing these
numbers from raw units unless you need serial-level detail.

## Fulfillable inventory

Fulfillable availability powers customer-facing ship/pickup decisions.

- Shipping checks ship-from-store locations (`enable_store_ship`).
- Pickup checks pickup-enabled locations.
- These checks use sellable inventory after thresholds, not raw on-hand.
- A size is shippable or pickup-eligible only when the relevant pool's sellable
  count is greater than zero.

Use:

```sh
pima inventory fulfillment --sku <SKU> --json
pima inventory availability --sku <SKU> --json
```

## Auto-routing

Auto-routing happens after an ecommerce order is created in PIMA.

Eligibility:

- Company `auto_routing_enabled` is true.
- Order is new, domestic, not blocked for approval, and has no pending
  alterations.
- Items are unrouted, non-pickup, and still new.

Routing sequence:

1. Route to `always_auto_route` locations first when they have sellable count at
   or above `auto_routing_threshold`.
2. Try one `routing_enabled` location that can fulfill all remaining items.
3. If no single location can fulfill all remaining items, split by best
   candidate: most fulfillable items, then proximity when geocodes exist, then
   position.
4. Leave items unrouted when no routing-enabled location has enough sellable
   inventory.

Important distinction: ecommerce sellable availability may include locations
that are not `routing_enabled`. Those locations can help the storefront sell
the item but will not receive automatic assignments.

## Common investigations

Explain why an item is available online but not auto-routed:

```sh
pima inventory availability --sku <SKU> --json
pima inventory fulfillment --sku <SKU> --json
pima resource list locations --json
```

Check the settings involved:

```sh
pima resource show companies 1 --json
pima resource show locations <id> --json
pima resource show products <id> --json
pima resource show skus <id> --json
```

Find products where transfering inventory can count:

```sh
pima resource list products --json
# Filter locally for include_transferring_in_sellable when the manifest exposes it,
# or inspect likely product records with `pima resource show products <id> --json`.
```

Manage settings safely:

```sh
pima resource describe companies
pima resource describe locations
pima resource describe products
pima resource describe skus

pima resource update locations <id> --data '{"routing_enabled":true}' --dry-run
pima resource update locations <id> --data '{"routing_enabled":true}' --yes
```

Always preview writes with `--dry-run`, and prefer changing the narrowest
record that matches the intent: company for global behavior, location for
location participation, product/SKU for item-specific buffers.
