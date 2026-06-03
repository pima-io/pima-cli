---
name: fulfillment
description: The order → shipment → pick/pack lifecycle and how transfers differ
when_to_use: Before working with shipments, picks, or transfers
scopes: [fulfillment:read, transfers:read]
related: [order-routing, inventory]
---

# Fulfillment

## The lifecycle

```
order → (routing assigns a fulfillment location per item) → shipment → pick → pack → weigh → ship
```

- An **order** can split across several fulfillment locations (per item — see
  the `order-routing` skill).
- A **shipment** is the outbound unit of work at one location. Shipments move
  through statuses: picking → packing → ready → shipped.
- **Batch picks / carts** group shipments for efficient picking.

`pima shipment list --status status_ready` shows what's staged to ship.

## Transfers are a separate domain

Transfers move inventory **between locations** (not customer-bound). They have
their own scope (`transfers:read` / `transfers:write`) and lifecycle:

```
transfer created → boxes packed → shipped → received (accepted) at destination
```

- `pima transfer list` / `pima transfer show <id>`
- `pima transfer-box set-missing <id>` / `set-found <id>` — reconcile a box that
  didn't arrive as expected (requires `transfers:write`).

Don't confuse a transfer (location→location) with rerouting an order item
(which reassigns *responsibility*, not physical stock).

## POS vs. the API

POS fulfillment actions run inside a clocked-in POS session and aren't reachable
by an API token. Anything the CLI does goes through the session-independent
endpoints instead.
