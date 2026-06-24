---
name: recipes
description: End-to-end command sequences for common multi-step tasks
when_to_use: When you want a worked example chaining several commands
scopes: []
related: [getting-started, question-catalog, metabase, order-routing, inventory, online-inventory]
---

# Recipes

Copy-pasteable sequences. All read commands accept `--json` for piping to `jq`.
For natural-language prompt ideas, read `pima skill question-catalog`.

## Inspect then reroute an unshippable order item

```sh
# 1. See what's stuck at a location:
pima order-item routing --location 7 --json | jq '.'

# 2. Confirm the destination actually has stock for that SKU:
pima inventory availability --sku BMSKUJY3 --location 9 --json | jq '.rows'

# 3. Reroute (preview first, then commit):
pima order-item reroute 12345 --to 9 --dry-run
pima order-item reroute 12345 --to 9 --yes
```

## Find something across PIMA

```sh
pima search "BMTSW001" --json | jq '.'
```

Use `search` for quick page/record lookup. For sales, product, team, inventory,
or fulfillment questions, prefer `pima questions` and the optimized `metrics`
or `inventory` commands first.

## Receive a purchase order safely

```sh
pima po show 13529 --json | jq '{id, vendor: .record.vendor_name, qty: .record.quantity}'
pima po accept 13529 --dry-run
pima po accept 13529 --yes
```

## List a queue for an agent to process

```sh
# Every shippable shipment at the ready queue, as JSON rows:
pima shipment list --status status_ready --json | jq '.[].id'
```

## Issue store credit (CX returns concierge)

```sh
pima customer show 90210 --json | jq '{name: .record.full_name, balance: .record.current_balance}'
pima credit add --customer 90210 --amount 25 --note "late shipment goodwill" --dry-run
pima credit add --customer 90210 --amount 25 --note "late shipment goodwill" --yes
```

## Create a markdown / coupon (finance)

```sh
pima resource fields coupons                 # see the keys first
pima resource create coupons --data '{"code":"SUMMER10","amount":10}' --dry-run
pima resource create coupons --data '{"code":"SUMMER10","amount":10}' --yes
```

## Start a cycle count / adjust inventory (ops)

```sh
pima resource fields cycle_counts
pima resource create cycle_counts --data '{"location_id":7}' --yes
# Larger stock corrections: create an inventory_audit, then its audit skus.
pima resource fields inventory_audits
```

## Invite a teammate (retail team mgmt)

```sh
pima resource fields invites
pima resource create invites --data '{"email":"new.hire@example.com","role":"associate"}' --dry-run
```

## Move sales between employee profiles (admin)

Use this when a new or reactivated employee profile has sales credited to the
wrong PIMA account. The server action requires a role with Manage Company and
an `admin:write` CLI token.

```sh
# 1. Find the source and target membership ids.
pima resource list memberships --q "matthew.kim@buckmason.com" --json | jq '.records[] | {id, user_email, user_full_name, status, home_location}'
pima resource list memberships --q "matt.kim@buckmason.com" --json | jq '.records[] | {id, user_email, user_full_name, status, home_location}'

# 2. Preview the action locally, then ask the server for the affected counts.
pima resource action memberships 1566 merge_sales \
  --data '{"to_membership_id":3465,"started_at":"2026-05-05","dry_run":true}' \
  --dry-run
pima resource action memberships 1566 merge_sales \
  --data '{"to_membership_id":3465,"started_at":"2026-05-05","dry_run":true}' \
  --yes --json | jq '.merge_sales'

# 3. If the count and date window are correct, run the merge.
pima resource action memberships 1566 merge_sales \
  --data '{"to_membership_id":3465,"started_at":"2026-05-05"}' \
  --yes --json | jq '.merge_sales'

# 4. Verify the target user now owns the team sales for the window.
pima metrics team --from 2026-05-05 --to 2026-06-23 --group-by all --json | jq '.groups[].rows[] | select(.id == 3467)'
```

`merge_sales` updates `orders.completed_by_id` from the membership in the URL
to `to_membership_id` for orders completed on or after `started_at` and before
optional `ended_at`. It also refreshes the affected daily team-performance
metric rows for both users. Always send `dry_run:true` first and compare the
returned `orders_count`, `total_cents`, and date range to the source request.

## Manage purchase alert emails (operational management)

```sh
# 1. Find the category records that should send purchase alerts.
pima resource list categories --q "Vintage" --json | jq '.records[] | {id, name, product_type, purchase_notification_emails}'

# 2. Confirm the live category schema before writing.
pima resource describe categories

# 3. Preview, then update each category. This field is a full replacement.
pima resource update categories 163 --data '{"purchase_notification_emails":"cody.wellema@buckmason.com"}' --dry-run
pima resource update categories 163 --data '{"purchase_notification_emails":"cody.wellema@buckmason.com"}' --yes
```

Purchase alert emails live on the merch category field
`purchase_notification_emails`. When an order item sells in a category with
that field set, PIMA sends `UserMailer.notify_purchase` to those recipients.
Because `resource update` replaces the field value, preserve existing addresses
manually when adding a recipient, e.g.
`"eric.freeman@buckmason.com, cody.wellema@buckmason.com"`. For a whole product
type like Vintage, list the matching categories and update each category id.

## Pull sales metrics (reporting / finance)

```sh
pima metrics sales --today --channel pos --json | jq '.'
pima metrics sales --today --channel pos --city "Los Angeles"
pima metrics sales --today --channel pos --group-by location_group
pima metrics sales --today --location-group-id 12 --group-by location_group
pima metrics sales --from 2026-06-01 --to 2026-06-08 --channel pos --compare previous_week
pima metrics sales --from 2026-05-01 --to 2026-05-31 --channel pos --state CA
pima metrics products --date 2026-06-06 --location-ids 12,34 --group-by style --json | jq '.rows'
pima metrics products --today --channel pos --city "Los Angeles" --group-by sku --limit 20
pima metrics products --today --group-by product_type --location-group-by city
pima metrics products --from 2026-05-01 --to 2026-05-31 --sort return_rate --min-units 10
pima metrics products --from 2026-05-31 --to 2026-06-06 --group-by gender --exclude-category "vintage,books"
pima metrics products --from 2026-06-01 --to 2026-06-08 --style "california t-shirt" --group-by sku
pima metrics team --today --group-by location_group --limit 3 --json | jq '.groups'
pima metrics team --date 2026-06-06 --group-by city --sort sales_per_hour
pima metrics team --today --q tshirts --sort units --group-by all
pima metrics team --today --min-sales 1000 --max-upt 1.5 --group-by all
```

Use `metrics sales` for totals like POS sales, orders, units, AOV, UPT,
plan attainment, and location/state/city/group rollups. It supports
`--group-by`, `--compare previous_week|previous_period|previous_year`,
`--under-plan`, `--min-sales`, and `--max-upt`. It uses server-side stored
daily metrics; do not page through raw orders to calculate these totals.
`metrics sales` cannot filter by merchandise attributes — for revenue
questions that include or exclude categories, product types, or Styles
(e.g. "net sales excluding vintage and books"), use `metrics products` with
`--category` / `--exclude-category`, `--product-type` /
`--exclude-product-type`, or `--style` / `--exclude-style` (comma-separated
names or ids; Style means the business Style / `ProductLine`), combined with
`--group-by gender` or another grain. Unknown names error rather than
silently returning unfiltered data, and the response echoes the applied
filters in `product_scope`.

Filter names must match the PIMA record name exactly (case-insensitive, but
no partial matching — "vintage" will not match "Vintage Books"). To discover
exact names first, run the same query with `--group-by category` (or
`product_type` / `style`) and read the labels, e.g. Buck Mason's vintage
merchandise spans several categories: "Vintage Books", "Vintage Jewelry",
"Vintage Accessories", etc. Then pass the full list:
`--exclude-category "Vintage Books,Vintage Jewelry,Vintage Accessories"`.

Use `metrics products` for top-selling SKUs, products, business Styles, product
types, categories, and gender splits by date/store/LocationGroup. For PIMA
business language, **Style** means `ProductLine`; request `--group-by style`.
Use `--location-group-by location_group` to group by Pima's actual
`LocationGroup` model, or `--location-group-by city|state|location|all` for
ad-hoc location dimensions. For return-rate questions, use `--sort return_rate`
with `--min-units` to avoid tiny denominators. Do not reconstruct dated style
sales from raw `units`: sold units do not carry the sale date needed for this
question.

Use `metrics team` for Retail Report v2 style team-member performance: top
team members by saved LocationGroup, location, city, state, or all selected
locations. The default grouping is `location_group`, backed by the actual Pima
`LocationGroup` model; `region` is only a legacy alias. Use
`--location-group`, `--location-group-id`, or `--location-group-ids` to select
saved groups before grouping/ranking. Default ranking is `net_sales`, with
`sales_per_hour`, `orders`, `units`, `aov`, `auv`, and `upt` available. For
product-specific questions like "who sold the most tshirts today?", pass
product filters (`--q`, `--sku`, `--product`, `--style`, `--category`,
`--product-type`) and usually rank with `--sort units` or `--sort sales`. Do
not page raw orders/timesheets for this.

## Answer on-hand and transferring inventory questions

```sh
pima inventory availability --sku BMSKUJY3 --short-name POS
pima inventory availability --product "Field Spec" --city "Los Angeles" --channel pos
pima inventory availability --category Shirts --state CA --all-pos --json | jq '.summary'
pima inventory risk --q tshirts --city "Los Angeles" --channel pos --at-risk
pima inventory fulfillment --sku BMSKUJY3 --city "Los Angeles" --channel pos
pima inventory transfers --sku BMSKUJY3 --short-name POS --direction inbound --status transfering
```

Use `inventory availability` before raw `units` for available, sellable,
on-hand, inbound transfer, and projected-availability questions. Use
`inventory transfers` when the user asks what is currently transferring or
where pending transfer units are moving. Use `inventory risk` when the user
asks which fast sellers are low on stock; it combines recent sales velocity
with sellable/projected availability and days of cover. Use
`inventory fulfillment` when the user asks where a SKU/order item can be
fulfilled from; it includes route eligibility and route-action metadata in
`--json`.

For compound questions like "Who sold the most tshirts today, broken down by
LocationGroup, and are those stores low on those tshirts?", first run
`pima metrics team --today --q tshirts --sort units --group-by location_group`, then
check stock with `pima inventory risk --q tshirts --all-pos --at-risk`.

## Explain or manage online sellable / fulfillable inventory

```sh
# 1. Load the durable mental model first.
pima skill online-inventory

# 2. Read the SKU/location inventory picture.
pima inventory availability --sku BMSKUJY3 --json | jq '.summary, .rows'
pima inventory fulfillment --sku BMSKUJY3 --json | jq '.'

# 3. Inspect the settings that decide whether inventory counts online,
#    whether it is fulfillable, and whether it can auto-route.
pima resource show companies 1 --json | jq '{all_products_sellable_online, enable_all_location_sellable_online, retail_inventory_threshold, all_retail_safety_inventory_threshold, auto_routing_enabled, auto_routing_threshold}'
pima resource show locations 108 --json | jq '{id, name, short_name, sellable_online, enable_store_ship, routing_enabled, always_auto_route, inventory_threshold, override_inventory_threshold, omit_all_retail_safety_inventory_threshold}'
pima resource show products 8452 --json | jq '{id, name, all_locations_sellable_online, all_locations_sellable_online_always, oos_threshold, include_transferring_in_sellable}'
pima resource show skus 12345 --json | jq '{id, name, oos_threshold}'

# 4. Preview writes before changing any behavior.
pima resource update locations 2 --data '{"routing_enabled":true}' --dry-run
pima resource update locations 2 --data '{"routing_enabled":true}' --yes
```

Use this when a user asks why an item is available online, why it did or did
not auto-route, whether a sellable-online store contributes to ecommerce
availability, or how to change the associated settings. The key distinction:
`sellable_online` can make inventory count online, `enable_store_ship` can make
it part of ship-from-store fulfillment checks, and `routing_enabled` is what
allows automatic assignment after the order lands. A location can be
sellable-online but not routable.

For Shopify pickup-only store availability, verify all four location flags
together. Disabling routing alone is not enough:

```sh
pima resource show locations <id> --json | jq '{id, name, short_name, pickup_enabled, sellable_online, enable_store_ship, routing_enabled}'

# Pickup-only for Shopify, without PIMA auto-routing:
pima resource update locations <id> --data '{"pickup_enabled":true,"sellable_online":true,"enable_store_ship":false,"routing_enabled":false}' --dry-run
```

Use `pickup_enabled: true` so the store can be offered for pickup,
`sellable_online: true` so store units can make the SKU available online,
`enable_store_ship: false` so the store is not part of the ship-capable
fulfillment pool, and `routing_enabled: false` so PIMA does not auto-assign
shipping order items there after checkout.

## Pull a report payload

```sh
pima report get inventory_on_hand_report --json
```

## Use Metabase for ad-hoc data aggregation

```sh
# 1. Authenticate to PIMA with reports read scope.
pima auth login --scopes reports:read

# 2. Let PIMA create a personal Metabase API key and log in the official mb CLI.
# If mb is missing, this installs @metabase/cli globally and retries.
pima metabase login

# 3. Discover saved questions and export a result set using the printed profile.
mb card list --profile <profile-from-login>
mb card query 60 --profile <profile-from-login> --export-format csv > pima-locations.csv
```

Use this when an agent needs to act through Metabase itself, such as
downloading CSVs from saved DataClip-imported questions, running ad-hoc
aggregate queries, or creating new Metabase questions. Only `reports:read` is
required on the PIMA token. PIMA brokers the Metabase API key server-side and
pipes it into `mb auth login`; the key is never printed. Pass
`pima metabase login --skip-install` in locked-down environments where global
npm installs are not allowed, or `--profile pima-staging` if you need a
non-default Metabase profile.

For questions like "Find our average parcel weight from DW over the last few
months":

1. Check whether PIMA already has an optimized command:
   `pima questions --match "parcel weight"`.
2. Interrogate the live API contract and relevant entities:
   `pima resource describe shipments --refresh`,
   `pima resource list locations --q DW --json`, and sample shipment rows if
   needed to confirm `scale_weight_oz` versus `expected_weight_oz`.
3. If the CLI can describe the rows but cannot aggregate them efficiently, use
   an ad-hoc Metabase query:

```sh
mb query --profile <profile-from-login> --file query.json --dry-run
mb query --profile <profile-from-login> --file query.json --json
```

Use `shipments.location_id` for ship-from location and `shipments.shipped_at`
for the fulfillment date window when the manifest documents those semantics.
Prefer actual scale weight when present; only fall back to expected/package
weight if the user agrees that label-estimated weight is acceptable.

If the result needs to be shareable with the team, create a saved Metabase card
instead of only running the ad-hoc query:

```sh
mb card create --profile <profile-from-login> --help
```

Do not create/update saved cards unless the user asks for a link/shareable
artifact or approves that step. See `pima skill metabase` for the full workflow.

## Receive a clean PO, hold a discrepant one (accounting)

```sh
pima po show 13529 --json | jq '{vendor: .record.vendor_name, qty: .record.quantity}'
pima po accept 13529 --yes        # only after the numbers check out
```

## Reach a verb that has no dedicated command

```sh
# Generic member-action escape hatch (any resource):
pima resource action transfer_boxes 88 set_missing --yes
# Generic CRUD for any catalog resource:
pima resource create order_returns --data '{...}' --yes
```

## Run headless (agents)

```sh
PIMA_HOST=https://pima.io PIMA_TOKEN=… pima orders list --status shippable --json | jq '.[0]'
```
