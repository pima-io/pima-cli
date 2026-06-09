import {Client} from './client.js'

export interface InventorySelectorParams {
  q?: string
  sku?: string
  sku_id?: string | number
  sku_ids?: string
  product?: string
  product_id?: string | number
  product_ids?: string
  category?: string
  category_id?: string | number
  category_ids?: string
  gender?: 'm' | 'w' | 'u' | string
  location_id?: string | number
  location_ids?: string
  location?: string
  location_name?: string
  short_name?: string
  location_group?: string
  location_group_id?: string | number
  location_group_ids?: string
  city?: string
  state?: string
  channel?: 'pos' | 'online' | 'all' | string
  all_pos?: boolean
  limit?: number
}

export interface InventoryAvailabilityParams extends InventorySelectorParams {
  include_zero?: boolean
}

export interface InventoryRiskParams extends InventorySelectorParams {
  date?: string
  from?: string
  to?: string
  recent_days?: number
  days_of_cover?: string | number
  days_of_cover_threshold?: string | number
  low_stock?: string | number
  low_stock_threshold?: string | number
  at_risk?: boolean
  refresh?: boolean
}

export interface InventoryTransfersParams extends InventorySelectorParams {
  direction?: 'inbound' | 'outbound' | 'both' | string
  status?: string
  statuses?: string
}

export interface InventoryFulfillmentParams extends InventorySelectorParams {
  order_item_id?: string | number
  item_id?: string | number
  include_zero?: boolean
}

export interface InventoryColumn {
  key: string
  label: string
}

export interface InventoryResource {
  id: string
  label: string
  columns: InventoryColumn[]
}

export interface InventoryScope {
  label: string
  selector: Record<string, unknown>
  location_ids?: number[]
  sku_ids?: number[]
  matches: Array<Record<string, unknown>>
  warnings: string[]
  limited?: boolean
}

export interface InventoryPayload<Row> {
  resource: InventoryResource
  filters: Record<string, unknown>
  location_scope: InventoryScope
  sku_scope: InventoryScope
  summary: Record<string, unknown>
  rows: Row[]
  generated_at: string
}

export type InventoryAvailabilityRow = Record<string, unknown> & {
  key: string
  sku_label: string
  product_label: string
  location_label: string
  available: number
  sellable: number
  pending_transfer: number
  transfering: number
  inbound_transfering: number
  projected_available: number
}

export type InventoryTransferRow = Record<string, unknown> & {
  key: string
  transfer_label: string
  direction: string
  sku_label: string
  from_location_label: string
  to_location_label: string
  status: string
  total_units: number
}

export type InventoryAvailability = InventoryPayload<InventoryAvailabilityRow>
export type InventoryTransfers = InventoryPayload<InventoryTransferRow>

export type InventoryRiskRow = InventoryAvailabilityRow & {
  risk_level: string
  recent_units_sold: number
  recent_revenue_cents: number
  avg_daily_units_sold: number
  days_of_cover?: number | null
}

export type InventoryFulfillmentRecommendationRow = InventoryAvailabilityRow & {
  recommendation: string
  route_allowed: boolean
  route_action?: Record<string, unknown>
}

export type InventoryRisk = InventoryPayload<InventoryRiskRow> & {
  range: {from: string; to: string}
  source: Record<string, string>
}

export type InventoryFulfillmentRecommendations = InventoryPayload<InventoryFulfillmentRecommendationRow> & {
  order_item?: Record<string, unknown> | null
}

export async function inventoryAvailability(client: Client, params: InventoryAvailabilityParams = {}): Promise<InventoryAvailability> {
  return client.get(`/api_inventory/availability.json?${queryString(params)}`)
}

export async function inventoryTransfers(client: Client, params: InventoryTransfersParams = {}): Promise<InventoryTransfers> {
  return client.get(`/api_inventory/transfers.json?${queryString(params)}`)
}

export async function inventoryRisk(client: Client, params: InventoryRiskParams = {}): Promise<InventoryRisk> {
  return client.get(`/api_inventory/risk.json?${queryString(params)}`)
}

export async function inventoryFulfillmentRecommendations(
  client: Client,
  params: InventoryFulfillmentParams = {},
): Promise<InventoryFulfillmentRecommendations> {
  return client.get(`/api_inventory/fulfillment_recommendations.json?${queryString(params)}`)
}

function queryString(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value == null || value === '' || value === false) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs.toString()
}
