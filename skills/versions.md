---
name: versions
description: Read resource history / PaperTrail versions for records
when_to_use: When you need to explain who changed a PIMA record, what changed, or when it changed
scopes: [<resource-domain>:read]
related: [resources, comments, data-model]
---

# Versions / Resource History

Use history when the question is "what changed?", "who changed it?", or "when did this record move states?".

Start by resolving the resource contract:

```bash
pima resource describe <resource>
```

Then read history for a record:

```bash
pima resource history <resource> <id>
pima resource history <resource> <id> --json
```

The command resolves the resource model from the live manifest and calls PIMA's `/versions.json` endpoint with `item_type` and `item_id`. It requires read access to the resource's domain. For example, `order_items` history requires `orders:read`; `customer_credits` history requires `customers:read`.

History entries are newest-first and include:

- event label (`Created`, `Updated`, `Destroyed`)
- author when PaperTrail can resolve one
- timestamp
- changed fields with `from` and `to` values

When a change references another record, PIMA may include a label and React path for that related record. Use `pima resource link <resource> <id>` when you need a browser URL to include in a report.
