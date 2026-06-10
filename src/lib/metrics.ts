import {Client} from './client.js'

export interface SalesSummaryParams {
  date?: string
  from?: string
  to?: string
  compare?: 'previous_period' | 'previous_week' | 'previous_year' | string
  compare_from?: string
  compare_to?: string
  channel?: 'pos' | 'online' | 'all' | string
  location_id?: string | number
  location_ids?: Array<string | number> | string
  location?: string
  location_name?: string
  short_name?: string
  location_group?: string
  location_group_id?: string | number
  location_group_ids?: Array<string | number> | string
  city?: string
  state?: string
  all_pos?: boolean
  gender?: string
  group_by?: 'location_group' | 'region' | 'location' | 'city' | 'state' | 'all' | string
  sort?: string
  under_plan?: boolean
  min_sales?: string | number
  max_upt?: string | number
  refresh?: boolean
}

export interface ProductPerformanceParams extends SalesSummaryParams {
  group_by?: 'sku' | 'product' | 'style' | 'product_line' | 'category' | 'product_type' | 'gender' | string
  location_group_by?: 'location_group' | 'region' | 'location' | 'city' | 'state' | 'all' | string
  grain?: string
  sort?: 'revenue' | 'net_revenue' | 'units' | 'returns' | 'return_revenue' | 'return_rate' | 'auv' | string
  min_units?: number
  min_revenue?: string | number
  min_return_rate?: string | number
  max_return_rate?: string | number
  limit?: number
  categories?: string
  exclude_categories?: string
  product_types?: string
  exclude_product_types?: string
  styles?: string
  exclude_styles?: string
}

export interface ProductSelectorParams {
  q?: string
  sku?: string
  sku_id?: string | number
  sku_ids?: Array<string | number> | string
  product?: string
  product_id?: string | number
  product_ids?: Array<string | number> | string
  style?: string
  product_line?: string
  product_line_id?: string | number
  product_line_ids?: Array<string | number> | string
  category?: string
  category_id?: string | number
  category_ids?: Array<string | number> | string
  product_type?: string
  product_type_id?: string | number
  product_type_ids?: Array<string | number> | string
}

export interface TeamPerformanceParams extends SalesSummaryParams, ProductSelectorParams {
  region?: string
  group_by?: 'location_group' | 'region' | 'location' | 'city' | 'state' | 'all' | string
  sort?:
    | 'net_sales'
    | 'sales'
    | 'sold'
    | 'returns'
    | 'sales_per_hour'
    | 'net_sales_per_hour'
    | 'orders'
    | 'units'
    | 'hours'
    | 'aov'
    | 'auv'
    | 'upt'
    | string
  limit?: number
  min_sales?: string | number
  min_net_sales?: string | number
  max_upt?: string | number
  min_units?: string | number
  min_orders?: string | number
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
  group_by?: string
  group_label?: string
  sort?: string
  group_count?: number
  groups?: SalesSummaryGroup[]
  comparison?: {
    range: {from: string; to: string}
    totals: Record<string, number>
    deltas: Record<string, {current: number; previous: number; delta: number; delta_percent?: number | null}>
  }
  generated_at: string
}

export interface LocationGroupRef {
  id: number
  name: string
  short_name?: string | null
  label: string
  enable_combined_reporting?: boolean
}

export interface SalesSummaryGroup {
  group: {
    id: string | number
    label: string
    type: string
    model?: 'LocationGroup' | string
    location_group?: LocationGroupRef
    location_ids: number[]
    locations?: Array<Record<string, unknown>>
  }
  totals: Record<string, number>
}

export async function salesSummary(client: Client, params: SalesSummaryParams = {}): Promise<SalesSummary> {
  return client.get(`/api_metrics/sales_summary.json?${queryString(params)}`)
}

export interface ProductPerformance {
  metric: 'product_performance'
  source: {model: string; refreshed?: boolean; calculated_at?: string; backfilling?: boolean; pending_metric_pairs?: number}
  backfilling?: boolean
  group_by: string
  group_label: string
  location_group_by?: string
  location_group_label?: string
  sort: string
  limit: number
  group_count: number
  limited: boolean
  range: {from: string; to: string}
  channel: string
  gender?: string | null
  product_scope?: {
    categories?: Array<{id: number; name: string}>
    excluded_categories?: Array<{id: number; name: string}>
    product_types?: Array<{id: number; name: string}>
    excluded_product_types?: Array<{id: number; name: string}>
    styles?: Array<{id: number; name: string}>
    excluded_styles?: Array<{id: number; name: string}>
  }
  location_scope: SalesSummary['location_scope']
  totals: ProductPerformanceTotals
  rows: ProductPerformanceRow[]
  groups?: ProductPerformanceLocationGroup[]
  generated_at: string
}

export interface ProductPerformanceLocationGroup {
  group: {
    id: string | number
    label: string
    type: string
    model?: 'LocationGroup' | string
    location_group?: LocationGroupRef
    location_ids: number[]
    locations?: Array<Record<string, unknown>>
  }
  totals: ProductPerformanceTotals
  group_count: number
  limited: boolean
  rows: ProductPerformanceRow[]
}

export interface ProductPerformanceTotals {
  revenue_cents: number
  return_revenue_cents: number
  net_revenue_cents: number
  units_sold_count: number
  returned_units_count: number
  return_rate_denominator_count: number
  return_rate: number
  average_unit_revenue_cents: number
}

export interface ProductPerformanceRow extends ProductPerformanceTotals {
  rank: number
  id: string | number
  label: string
  group_type: string
  entity?: Record<string, unknown>
}

export async function productPerformance(client: Client, params: ProductPerformanceParams = {}): Promise<ProductPerformance> {
  return client.get(`/api_metrics/product_performance.json?${queryString(params)}`)
}

export interface TeamPerformance {
  metric: 'team_performance'
  source: {model: string; supporting_model?: string; refreshed?: boolean; calculated_at?: string}
  group_by: string
  group_label: string
  sort: string
  limit: number
  range: {from: string; to: string}
  channel: string
  gender?: string | null
  location_scope: SalesSummary['location_scope']
  product_scope?: {label: string; selector: Record<string, unknown>; search_terms: string[]}
  totals: TeamPerformanceTotals
  group_count: number
  groups: TeamPerformanceGroup[]
  generated_at: string
}

export interface TeamPerformanceGroup {
  group: {
    id: string | number
    label: string
    type: string
    model?: 'LocationGroup' | string
    location_group?: LocationGroupRef
    location_ids: number[]
    locations?: Array<Record<string, unknown>>
  }
  totals: TeamPerformanceTotals
  user_count: number
  limited: boolean
  rows: TeamPerformanceRow[]
}

export interface TeamPerformanceTotals {
  sold_cents: number
  returned_cents: number
  net_sales_cents: number
  orders_count: number
  units_count: number
  hours_worked: number
  average_order_value_cents: number
  units_per_transaction: number
  average_unit_value_cents: number
  sales_per_hour_cents: number
  net_sales_per_hour_cents: number
}

export interface TeamPerformanceRow extends TeamPerformanceTotals {
  rank: number
  id: string | number
  label: string
  user?: Record<string, unknown>
}

export async function teamPerformance(client: Client, params: TeamPerformanceParams = {}): Promise<TeamPerformance> {
  return client.get(`/api_metrics/team_performance.json?${queryString(params)}`)
}

function queryString(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as Array<[string, unknown]>) {
    if (value == null || value === '' || value === false) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs.toString()
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

export function flatProductPerformanceRows(payload: ProductPerformance): Array<Record<string, string | number>> {
  const rows: Array<{locationGroup?: string; row: ProductPerformanceRow}> = payload.groups?.length
    ? payload.groups.flatMap((group) => group.rows.map((row) => ({locationGroup: group.group.label, row})))
    : (payload.rows ?? []).map((row) => ({row}))

  return rows.map(({locationGroup, row}) => ({
    ...(locationGroup ? {[payload.location_group_by ?? 'location_group']: locationGroup} : {}),
    rank: row.rank,
    [payload.group_by]: row.label,
    revenue: dollars(row.revenue_cents),
    net_revenue: dollars(row.net_revenue_cents),
    units: row.units_sold_count ?? 0,
    returns: row.returned_units_count ?? 0,
    return_revenue: dollars(row.return_revenue_cents),
    return_rate: percentRate(row.return_rate),
    auv: dollars(row.average_unit_revenue_cents),
  }))
}

export function flatTeamPerformanceRows(payload: TeamPerformance): Array<Record<string, string | number>> {
  return (payload.groups ?? []).flatMap((group) =>
    (group.rows ?? []).map((row) => ({
      [payload.group_by]: group.group.label,
      rank: row.rank,
      team_member: row.label,
      net_sales: dollars(row.net_sales_cents),
      sales: dollars(row.sold_cents),
      returns: dollars(row.returned_cents),
      orders: row.orders_count ?? 0,
      units: row.units_count ?? 0,
      hours: row.hours_worked ?? 0,
      sales_per_hour: dollars(row.sales_per_hour_cents),
      net_sales_per_hour: dollars(row.net_sales_per_hour_cents),
      aov: dollars(row.average_order_value_cents),
      auv: dollars(row.average_unit_value_cents),
      upt: row.units_per_transaction ?? 0,
    })),
  )
}

export function flatSalesSummaryGroups(summary: SalesSummary): Array<Record<string, string | number>> {
  return (summary.groups ?? []).map((group) => {
    const totals = group.totals ?? {}
    return {
      [summary.group_by ?? 'group']: group.group.label,
      net_sales: dollars(totals.net_sales_cents),
      sales: dollars(totals.item_revenue_cents),
      total_revenue: dollars(totals.total_revenue_cents),
      net_plan: dollars(totals.net_sales_plan_cents),
      plan_attainment: percentRate(totals.net_sales_plan_attainment),
      orders: totals.orders_count ?? 0,
      units: totals.units_sold_count ?? 0,
      aov: dollars(totals.average_order_value_cents),
      upt: totals.units_per_transaction ?? 0,
      visits: totals.visits_count ?? 0,
      conversion_rate: percent(totals.conversion_rate),
      sales_per_hour: dollars(totals.sales_per_hour_cents),
    }
  })
}

function dollars(cents: unknown): string {
  const amount = typeof cents === 'number' ? cents : Number(cents ?? 0)
  return `$${(amount / 100).toFixed(2)}`
}

function percent(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  return `${amount.toFixed(2)}%`
}

function percentRate(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  return `${(amount * 100).toFixed(2)}%`
}
