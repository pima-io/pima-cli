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
  city?: string
  state?: string
  channel?: 'pos' | 'online' | 'all' | string
  all_pos?: boolean
  limit?: number
}

export interface InventoryAvailabilityParams extends InventorySelectorParams {
  include_zero?: boolean
}

export interface InventoryTransfersParams extends InventorySelectorParams {
  direction?: 'inbound' | 'outbound' | 'both' | string
  status?: string
  statuses?: string
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

export async function inventoryAvailability(client: Client, params: InventoryAvailabilityParams = {}): Promise<InventoryAvailability> {
  return client.get(`/api_inventory/availability.json?${queryString(params)}`)
}

export async function inventoryTransfers(client: Client, params: InventoryTransfersParams = {}): Promise<InventoryTransfers> {
  return client.get(`/api_inventory/transfers.json?${queryString(params)}`)
}

function queryString(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value == null || value === '' || value === false) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs.toString()
}
