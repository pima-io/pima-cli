---
name: recipes
description: End-to-end command sequences for common multi-step tasks
when_to_use: When you want a worked example chaining several commands
scopes: []
related: [getting-started, question-catalog, order-routing, inventory]
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

## Pull a report payload

```sh
pima report get inventory_on_hand_report --json
```

## Enroll Metabase CLI and download a saved-question CSV

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
downloading CSVs from saved DataClip-imported questions or creating new
Metabase questions. Only `reports:read` is required on the PIMA token. PIMA
brokers the Metabase API key server-side and pipes it into `mb auth login`; the
key is never printed. Pass
`pima metabase login --skip-install` in locked-down environments where global
npm installs are not allowed, or `--profile pima-staging` if you need a
non-default Metabase profile.

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
