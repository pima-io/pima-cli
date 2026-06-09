---
name: data-model
description: The item-master hierarchy and the critical model-name vs UI-label mapping
when_to_use: Before querying products/skus or interpreting any "Style"/"Class" field
scopes: [products:read]
related: [inventory, order-routing]
---

# PIMA data model — read this before touching products

## The naming trap (most important thing in this CLI)

PIMA's model names **do not match** the labels users see in the UI, CSVs, and
reports. This is the result of an item-master hierarchy restructuring. If you
assume the model named `Style` is what the business calls a "Style," you will
pull the wrong data.

| Model | UI / business label | Example |
|---|---|---|
| `Style` | **"Class"** | "Knit Tops" |
| `ProductLine` | **"Style"** | "California T-Shirt" |
| `Product` | "Product" (a colorway) | "California T-Shirt – Black" |
| `Sku` | "SKU" (a size variant) | "BMTSW001-BLK-M" |

So when output is labeled **"Style"**, it comes from the **`ProductLine`** model
(`product_lines.name`) — *not* the `Style` model and *not* `products.code`.

The hierarchy, top to bottom:

```
Category → Style(=Class) → ProductLine(=Style) → Product(=colorway) → Sku(=size) → Unit(=physical item)
```

## Products and SKUs

- A `Product` has a `code` attribute (not `product_code`).
- `Product` belongs to `ProductLine → Style → Category` — there is **no** direct
  category association on a product.
- **Gender** lives on `product_lines.gender`: `'m'` (mens), `'w'` (womens),
  `'u'` (unisex).
- SKU names are validated strictly: uppercase alphanumeric + dots only
  (`/\A[A-Z0-9.]+\Z/`).

## Units and inventory status

A `Unit` is one physical item. Its `status` is the source of truth for whether
it can be sold:

| status | meaning |
|---|---|
| `available` | sellable — this is the one you usually want |
| `damaged` | not sellable |
| `sold` | already sold |
| `pending_transfer` | committed to a transfer |
| `pending_shipment` | committed to a shipment |
| `missing` | unaccounted for |

To count sellable inventory, filter `status: 'available'` — **not** `'in_stock'`
(no such value). "On-hand" and "available" are different questions: on-hand may
include non-sellable statuses.

## Practical guidance for agents

- When a user says "Style," they almost always mean a `ProductLine`. Confirm if
  ambiguous.
- When a user says "LocationGroup" or asks for a saved location group, use the
  actual Pima `LocationGroup` model via `--location-group`,
  `--location-group-id`, or `--location-group-ids`. Use `city`, `state`,
  `location`, or `all` for ad-hoc location rollups. `region` is a legacy alias
  for `location_group`, not a separate `Location` column.
- For top-selling styles by date/store, use
  `pima metrics products --group-by style`; it groups
  `DailySkuPerformanceMetric` by `product_line_id`.
- For "who sold the most <product/category> today?", use
  `pima metrics team --q tshirts --sort units --group-by all`. Product filters
  search SKU, product, business Style/ProductLine, category, and product type;
  `tshirt`, `tshirts`, `tee`, and `tees` are treated as related terms.
- `pima resource list skus --q <term>` searches SKUs. `pima sku show
  <id-or-name>` is for an exact SKU detail lookup after you know the identifier.
- Inventory questions should specify a location — most counts are per-location.
