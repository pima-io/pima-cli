---
name: purchasing
description: The purchase-order lifecycle — create, accept (receive), undo
when_to_use: Before accepting or undoing a purchase order
scopes: [purchasing:read, purchasing:write]
related: [inventory]
---

# Purchasing

## The PO lifecycle

```
draft → start → accept (receive) → [units enter inventory]
                      └── undo (reverse the receipt)
```

- **Accept** receives the PO: it brings the ordered units into inventory at the
  destination. This is the consequential step.
- **Undo** reverses a receipt — use it when a PO was accepted in error.

## Commands

- `pima po list` / `pima po show <id>` — `purchasing:read`
- `pima po accept <id> --yes` — receives the PO (`purchasing:write`)
- `pima po undo <id> --yes` — reverses the receipt (`purchasing:write`)

Both writes support `--dry-run` to preview and require `--yes` to execute. A
read-only token gets exit code 3.

## Gotchas

- Accepting is not idempotent in effect — it creates inventory. Confirm the PO
  with `pima po show` before accepting.
- Costs and SKU edits on a PO are separate write actions; use the dashboard for
  bulk cost work.
