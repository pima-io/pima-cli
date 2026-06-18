---
name: calendar
description: NRF / retail calendar mapping for fiscal-year, week, month, and quarter questions
when_to_use: When a user asks for NRF week/month/quarter, retail calendar, fiscal week, merch week, or FY-based date ranges
scopes: [reports:read]
related: [question-catalog, data-model]
---

# NRF / retail calendar

PIMA uses a server-side merch calendar (`MerchCalendar::RetailCalendar`) for
NRF / retail / fiscal / merch periods. Do not infer 4-5-4 dates manually in an
agent. Ask PIMA to resolve the period, or pass NRF fields directly to metrics
commands.

Supported aliases:

- `NRF calendar`
- `retail calendar`
- `fiscal week/month/quarter/year`
- `merch week/month/quarter/year`
- `FY2025`, `FY25`

## Resolve first

Use this when you need to explain or verify the date range:

```
pima calendar resolve --fy 2025 --nrf-week 48 --json
pima calendar resolve --period "nrf week 48 in FY2025" --json
```

The response includes the exact Gregorian `range`, NRF label, fiscal week,
month, quarter, year length, and previous-year / previous-week comparison
ranges.

## Metrics can take NRF fields directly

For revenue:

```
pima metrics sales --fy 2025 --nrf-week 48 --json
pima metrics sales --period "nrf week 48 in FY2025" --json
```

Read `totals.net_sales_cents` for net revenue.

For product/style/SKU questions:

```
pima metrics products --fy 2025 --nrf-week 48 --group-by style --json
pima metrics products --fy 2025 --nrf-month 12 --group-by sku --sort net_revenue --json
```

For team questions:

```
pima metrics team --fy 2025 --nrf-week 48 --group-by location_group --json
```

## Agent rules

- Prefer `--fy` + `--nrf-week` / `--nrf-month` / `--nrf-quarter` over manual
  `--from` / `--to`.
- If the user gives a natural phrase, `--period "nrf week 48 in FY2025"` is OK.
- Do not combine calendar params with `--date`, `--from`, or `--to`.
- Use `pima_calendar_resolve` over MCP when answering in chat and you need the
  concrete dates.
