---
name: metabase
description: Use the authorized Metabase CLI for ad-hoc PIMA data aggregation and shareable saved questions
when_to_use: When a natural-language question needs aggregation that no optimized PIMA command answers cleanly, especially if the user wants a team-shareable query
scopes: [reports:read]
related: [question-catalog, recipes, data-model, resources]
---

# Metabase aggregation workflow

Use optimized PIMA commands first. For sales, product, team, calendar, inventory,
routing, and audit questions, check `pima questions`, `pima metrics ...`,
`pima inventory ...`, and `pima resource describe ...` before writing SQL.

When the user asks an ad-hoc data aggregation question that is not covered by a
first-class PIMA command, and the Metabase CLI is already authorized, use
Metabase instead of paging raw resources. Examples:

- "Find our average parcel weight from DW over the last few months."
- "What is the median shipment weight by ship-from warehouse?"
- "How many labels did each location buy last quarter by carrier?"

## Decision rule

1. Run `pima questions --match "<user question>"` to check for an optimized
   command mapping.
2. Inspect the live PIMA API manifest with `pima resource describe <resource>
   --refresh` and, when needed, `pima resource fields <resource> --refresh`.
   Use the manifest to identify exact resources, filters, fields, paths, and
   controller docs. Do not guess column names from UI labels.
3. Resolve relevant entity ids through PIMA resources before querying, such as
   `pima resource list locations --q DW --json` for Dallas Warehouse.
4. If the question requires aggregation over rows/columns that the CLI can
   describe but not aggregate efficiently, use `mb query` with an ad-hoc native
   SQL or MBQL body.
5. If the result needs to be shareable with the team, create or update a saved
   Metabase card instead of only running an ad-hoc query.

## Authenticate

PIMA brokers the Metabase API key. The key is not printed.

```sh
pima auth login --scopes reports:read
pima metabase login
```

On the production PIMA host, `pima metabase login` enrolls the official
Metabase CLI against `https://metabase.pima.io` and normally prints the
`pima-production` profile. Use the printed profile if PIMA returns a different
one:

```sh
mb card list --profile pima-production
mb query --profile pima-production --help
mb card create --profile pima-production --help
```

If `mb` is not authorized yet, run `pima metabase login`. If the user explicitly
does not want Metabase, stay within PIMA CLI/API commands and explain any
limitation.

## Ad-hoc query pattern

For one-off answers, build a query body and dry-run it before execution:

```sh
mb query --profile pima-production --file query.json --dry-run
mb query --profile pima-production --file query.json --json
```

Use `mb query --print-schema` and `mb skills get mbql` when using MBQL. For
native SQL, keep the result narrow: select only the needed aggregate columns and
use explicit date/location filters.

For the parcel-weight example:

1. Resolve DW:
   `pima resource list locations --q DW --json`.
2. Inspect shipments:
   `pima resource describe shipments --refresh`.
3. Use the manifest docs to anchor filters on `shipments.location_id` and
   `shipments.shipped_at`, and weight fields such as `scale_weight_oz` or
   `expected_weight_oz` from shipment records/columns.
4. Run a Metabase ad-hoc aggregate such as average non-null scale weight for
   DW shipments over the requested date window, falling back to expected weight
   only if the user agrees that label-estimated weight is acceptable.

## Shareable query pattern

Use a saved Metabase card when the user asks for a link, wants the result shared
with the team, or the query is likely to be reused.

```sh
mb card create --profile pima-production --help
mb card query <card-id> --profile pima-production --export-format csv > results.csv
```

Name saved questions clearly, include the source resources/fields in the
description, and prefer read-only aggregate SQL. Do not create or update saved
cards unless the user asked for a shareable/team artifact or approved it.

## Safety

- Treat Metabase as read-only unless the user explicitly asks to create/update a
  saved card.
- Prefer aggregate SQL over exporting raw customer/order rows.
- Do not expose sensitive codes or customer data unless the gated PIMA manifest
  and the user's request make that appropriate.
- Include the exact date window, resource names, and fields used in the final
  answer so the result is auditable.
