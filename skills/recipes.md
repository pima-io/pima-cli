---
name: recipes
description: End-to-end command sequences for common multi-step tasks
when_to_use: When you want a worked example chaining several commands
scopes: []
related: [getting-started, order-routing, inventory]
---

# Recipes

Copy-pasteable sequences. All read commands accept `--json` for piping to `jq`.

## Inspect then reroute an unshippable order item

```sh
# 1. See what's stuck at a location:
pima order-item routing --location 7 --json | jq '.'

# 2. Confirm the destination actually has stock for that SKU:
pima sku show 8842 --json | jq '.record.inventory'

# 3. Reroute (preview first, then commit):
pima order-item reroute 12345 --to 9 --dry-run
pima order-item reroute 12345 --to 9 --yes
```

## Find something across PIMA

```sh
pima search "BMTSW001" --json | jq '.'
```

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
pima metrics sales --from 2026-05-01 --to 2026-05-31 --channel pos --state CA
```

Use `metrics sales` for totals like POS sales, orders, units, AOV, UPT, and
location/state/city/group rollups. It uses server-side stored daily metrics;
do not page through raw orders to calculate these totals.

## Answer on-hand and transferring inventory questions

```sh
pima inventory availability --sku BMSKUJY3 --short-name POS
pima inventory availability --product "Field Spec" --city "Los Angeles" --channel pos
pima inventory availability --category Shirts --state CA --all-pos --json | jq '.summary'
pima inventory transfers --sku BMSKUJY3 --short-name POS --direction inbound --status transfering
```

Use `inventory availability` before raw `units` for available, sellable,
on-hand, inbound transfer, and projected-availability questions. Use
`inventory transfers` when the user asks what is currently transferring or
where pending transfer units are moving.

## Pull a report payload

```sh
pima report get inventory_on_hand_report --json
```

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
