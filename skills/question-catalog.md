---
name: question-catalog
description: Example business questions the CLI can answer and the optimized commands agents should prefer
when_to_use: When an agent wants ideas for what to ask PIMA or needs to map a natural-language question to the right CLI/API path
scopes: [reports:read, inventory:read, orders:read, transfers:read]
related: [recipes, data-model, calendar, inventory, order-routing, fulfillment, metabase]
---

# Question catalog

Use these as prompt patterns. Prefer the optimized `metrics` and `inventory`
commands before paging raw resources.

Saved location groups are the actual Pima `LocationGroup` model. Select them
with `--location-group`, `--location-group-id`, or `--location-group-ids`, and
group by them with `--group-by location_group` or `--location-group-by
location_group`. Use `city`, `state`, `location`, or `all` for ad-hoc location
rollups. `region` is a legacy alias for `location_group`.

For NRF / retail / fiscal calendar questions, do not infer dates manually. Use
`pima calendar resolve`, or pass `--fy` plus `--nrf-week`, `--nrf-month`, or
`--nrf-quarter` directly to `metrics` commands. `--period "nrf week 48 in
FY2025"` is also supported.

For ad-hoc aggregation questions that are not covered by an optimized
`metrics`, `inventory`, or resource command, use the authorized Metabase CLI when
available. Interrogate the PIMA API manifest and relevant resources/entities
first, then run an ad-hoc `mb query`; create a saved Metabase card only when the
answer needs to be shareable with the team. See `pima skill metabase`.

## Sales / Store Health

- "How are POS sales today by saved LocationGroup?"
  Use `pima metrics sales --today --channel pos --group-by location_group`.
- "Which California stores are underperforming today?"
  Use `pima metrics sales --today --channel pos --state CA --group-by location --under-plan`.
- "Compare Los Angeles POS sales this week vs last week."
  Use `pima metrics sales --from <week-start> --to <week-end> --channel pos --city "Los Angeles" --compare previous_week`.
- "Which stores have the highest AOV today?"
  Use `pima metrics sales --today --channel pos --group-by location --sort aov`.
- "Which store has the best sales per labor hour this week?"
  Use `pima metrics sales --from <week-start> --to <week-end> --channel pos --group-by location --sort sales_per_hour`.
- "Show me POS sales for SoHo and Nashville last Saturday."
  Use `pima metrics sales --date <saturday> --channel pos --location-ids <ids>` after resolving the stores.
- "Pull net rev in NRF week 48 in FY2025."
  Use `pima metrics sales --fy 2025 --nrf-week 48 --json` and read `totals.net_sales_cents`.
- "Compare POS net revenue in NRF week 48 FY2025 to last year."
  Use `pima metrics sales --fy 2025 --nrf-week 48 --channel pos --compare previous_year --json`.

## Product Performance

- "What were the top selling styles in LA last Saturday?"
  Use `pima metrics products --date <saturday> --channel pos --city "Los Angeles" --group-by style`.
- "What SKUs drove the most revenue today?"
  Use `pima metrics products --today --group-by sku --sort revenue`.
- "Which categories are returning the most this month?"
  Use `pima metrics products --from <month-start> --to <month-end> --group-by category --sort return_revenue`.
- "What are the top women's styles in California this week?"
  Use `pima metrics products --from <week-start> --to <week-end> --state CA --gender w --group-by style`.
- "What product types are selling best by city?"
  Use `pima metrics products --today --group-by product_type --location-group-by city`.
- "What were the top styles in NRF week 48 FY2025?"
  Use `pima metrics products --fy 2025 --nrf-week 48 --group-by style --json`.
- "Which SKU has the highest return rate in the last 30 days?"
  Use `pima metrics products --from <30-days-ago> --to <today> --group-by sku --sort return_rate --min-units 10`.

## Team Performance

- "Who were the top performing team members in each LocationGroup today?"
  Use `pima metrics team --today --group-by location_group`.
- "Who sold the most tshirts today?"
  Use `pima metrics team --today --q tshirts --sort units --group-by all`.
- "Who had the highest sales per hour this week?"
  Use `pima metrics team --from <week-start> --to <week-end> --group-by all --sort sales_per_hour`.
- "Who sold the most women's products in LA?"
  Use `pima metrics team --today --city "Los Angeles" --gender w --sort sales --group-by all`.
- "Rank team members by units sold in Nashville last Saturday."
  Use `pima metrics team --date <saturday> --location Nashville --sort units --group-by all`.
- "Who sold the most in NRF week 48 FY2025?"
  Use `pima metrics team --fy 2025 --nrf-week 48 --sort net_sales --group-by all --json`.
- "Which team members have high sales but low UPT?"
  Use `pima metrics team --today --min-sales 1000 --max-upt 1.5 --group-by all`.

## Inventory

- "How many white pima tees are on hand in SoHo?"
  Use `pima inventory availability --q "white pima tee" --location SoHo`.
- "What tshirts are available in Los Angeles stores?"
  Use `pima inventory availability --q tshirts --city "Los Angeles" --channel pos`.
- "Which stores are low on best-selling SKUs?"
  Use `pima inventory risk --all-pos --at-risk`.
- "What inventory is transferring into Nashville?"
  Use `pima inventory transfers --location Nashville --direction inbound`.
- "Which SKUs are oversold or have negative sellable counts?"
  Use `pima inventory availability --all-pos --include-zero --json` and inspect rows with negative `sellable`, or narrow by product/category first.
- "Where can we fulfill this SKU from nearby?"
  Use `pima inventory fulfillment --sku <sku> --city <city> --channel pos`.

## Ops / Order Routing

- "What shippable orders are blocked right now?"
  Use `pima order-item routing --json` and inspect the routing dashboard payload.
- "Which unshippable items can be rerouted to another store?"
  Use `pima order-item routing --json`, then `pima inventory fulfillment --order-item-id <id> --json`.
- "Show me the routing issues for SoHo."
  Use `pima order-item routing --location <soho-id> --json`.
- "Find orders stuck because inventory is pending transfer."
  Use `pima order-item routing --json`, then cross-check SKUs with `pima inventory transfers`.

## Ad-hoc Data Aggregation

- "Find our average parcel weight from DW over the last few months."
  First try `pima questions --match "parcel weight"` and inspect `pima resource describe shipments --refresh`; resolve DW with `pima resource list locations --q DW --json`. If no optimized command answers the aggregate and `mb` is authorized, run an ad-hoc `mb query` against shipments using `location_id`, `shipped_at`, and weight fields from the manifest/records. Save a Metabase card only if the user needs a team-shareable query.
- "Build a shareable report for average shipment weight by warehouse."
  Use `pima skill metabase`, verify shipment fields through the manifest, then create a saved Metabase card with `mb card create` after the user approves the shareable artifact.

## Audit / Collaboration

- "What changed on order item 12345?"
  Use `pima resource history order_items 12345`.
- "Show comments and @mentions on product 42."
  Use `pima resource comments products 42`.
- "Create a direct Pima link for the POS orders view filtered to today."
  Use `pima resource link orders --variant pos --filter completed_from=<today> --filter completed_to=<today>`.
- "Export customers matching Dolph."
  Use `pima resource export customers --q Dolph`.
- "File feedback that the metrics endpoint should support sell-through by SKU."
  Use `pima feedback feature "Support sell-through by SKU in metrics" --context ...`.

## Compound Stress Test

- "Who sold the most tshirts today, broken down by LocationGroup, and are those stores low on those tshirts?"
  First use `pima metrics team --today --q tshirts --sort units --group-by location_group`, then use `pima inventory risk --q tshirts --all-pos --at-risk` or narrow by the returned locations.
