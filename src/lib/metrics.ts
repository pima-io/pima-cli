import {Client} from './client.js'

export interface SalesSummaryParams {
  date?: string
  from?: string
  to?: string
  channel?: 'pos' | 'online' | 'all' | string
  location_id?: string | number
  location_ids?: Array<string | number> | string
  location?: string
  location_name?: string
  short_name?: string
  location_group?: string
  city?: string
  state?: string
  all_pos?: boolean
  gender?: string
  refresh?: boolean
}

export interface SalesSummary {
  metric: 'sales_summary'
  source: {model: string; refreshed?: boolean; calculated_at?: string}
  range: {from: string; to: string}
  channel: string
  gender?: string | null
  location_scope: {
    label: string
    selector: Record<string, unknown>
    location_ids: number[]
    matches: Array<{id: number; name: string; short_name: string; city?: string; state?: string; pos_enabled?: boolean}>
    warnings: string[]
  }
  totals: Record<string, number>
  by_location: Array<{location: Record<string, unknown>; totals: Record<string, number>}>
  generated_at: string
}

export async function salesSummary(client: Client, params: SalesSummaryParams = {}): Promise<SalesSummary> {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || value === false) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return client.get(`/api_metrics/sales_summary.json?${qs.toString()}`)
}

export function flatSalesSummary(summary: SalesSummary): Record<string, string | number> {
  const totals = summary.totals ?? {}
  return {
    range: summary.range.from === summary.range.to ? summary.range.from : `${summary.range.from}..${summary.range.to}`,
    channel: summary.channel,
    location_scope: summary.location_scope?.label ?? '',
    item_revenue: dollars(totals.item_revenue_cents),
    item_returns: dollars(totals.item_returns_cents),
    net_sales: dollars(totals.net_sales_cents),
    total_revenue: dollars(totals.total_revenue_cents),
    gross_plan: dollars(totals.gross_sales_plan_cents),
    net_plan: dollars(totals.net_sales_plan_cents),
    mens_net_sales: dollars(totals.mens_net_sales_cents),
    womens_net_sales: dollars(totals.womens_net_sales_cents),
    orders: totals.orders_count ?? 0,
    units: totals.units_sold_count ?? 0,
    aov: dollars(totals.average_order_value_cents),
    upt: totals.units_per_transaction ?? 0,
    auv: dollars(totals.average_unit_value_cents),
    visits: totals.visits_count ?? 0,
    conversion_rate: percent(totals.conversion_rate),
    new_customers: totals.new_customers_count ?? 0,
    hours_worked: totals.hours_worked ?? 0,
    sales_per_hour: dollars(totals.sales_per_hour_cents),
    ship_from_store: dollars(totals.shipped_from_store_revenue_cents),
    shipments: totals.shipments_count ?? 0,
    inventory_on_hand: dollars(totals.inventory_on_hand_cents),
    pickup_item_revenue: dollars(totals.pickup_item_revenue_cents),
    pickup_items: totals.pickup_item_count ?? 0,
  }
}

function dollars(cents: unknown): string {
  const amount = typeof cents === 'number' ? cents : Number(cents ?? 0)
  return `$${(amount / 100).toFixed(2)}`
}

function percent(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  return `${amount.toFixed(2)}%`
}
