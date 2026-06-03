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

## Reach a verb that has no dedicated command

```sh
# Generic member-action escape hatch (any resource):
pima resource action transfer_boxes 88 set_missing --yes
```

## Run headless (agents)

```sh
PIMA_HOST=https://your-pima PIMA_TOKEN=… pima orders list --status shippable --json | jq '.[0]'
```
