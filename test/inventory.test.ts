import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {inventoryAvailability, inventoryFulfillmentRecommendations, inventoryRisk, inventoryTransfers} from '../src/lib/inventory.js'

describe('inventory helpers', () => {
  it('fetches availability with SKU and location selectors encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          resource: {id: 'inventory_availability', label: 'Inventory Availability', columns: []},
          filters: {},
          location_scope: {label: 'POS', selector: {}, matches: [], warnings: []},
          sku_scope: {label: 'SKU', selector: {}, matches: [], warnings: []},
          summary: {},
          rows: [],
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await inventoryAvailability(client, {
      sku: 'BMSKUJY3',
      short_name: 'POS',
      location_group: 'California Stores',
      location_group_id: 12,
      city: 'Los Angeles',
      state: 'CA',
      all_pos: true,
      include_zero: true,
      limit: 25,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_inventory/availability.json')
    assert.equal(qs.get('sku'), 'BMSKUJY3')
    assert.equal(qs.get('short_name'), 'POS')
    assert.equal(qs.get('location_group'), 'California Stores')
    assert.equal(qs.get('location_group_id'), '12')
    assert.equal(qs.get('city'), 'Los Angeles')
    assert.equal(qs.get('state'), 'CA')
    assert.equal(qs.get('all_pos'), 'true')
    assert.equal(qs.get('include_zero'), 'true')
    assert.equal(qs.get('limit'), '25')
  })

  it('fetches transfers with direction and status encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          resource: {id: 'inventory_transfers', label: 'Inventory Transfers', columns: []},
          filters: {},
          location_scope: {label: 'POS', selector: {}, matches: [], warnings: []},
          sku_scope: {label: 'SKU', selector: {}, matches: [], warnings: []},
          summary: {},
          rows: [],
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await inventoryTransfers(client, {
      product: 'Field Spec',
      location_ids: '7,9',
      direction: 'inbound',
      status: 'transfering,picking',
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_inventory/transfers.json')
    assert.equal(qs.get('product'), 'Field Spec')
    assert.equal(qs.get('location_ids'), '7,9')
    assert.equal(qs.get('direction'), 'inbound')
    assert.equal(qs.get('status'), 'transfering,picking')
  })

  it('fetches inventory risk with velocity thresholds encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          resource: {id: 'inventory_risk', label: 'Inventory Risk', columns: []},
          filters: {},
          range: {from: '2026-05-10', to: '2026-06-08'},
          source: {inventory_model: 'Unit', velocity_model: 'DailySkuPerformanceMetric'},
          location_scope: {label: 'POS', selector: {}, matches: [], warnings: []},
          sku_scope: {label: 'SKU', selector: {}, matches: [], warnings: []},
          summary: {},
          rows: [],
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await inventoryRisk(client, {
      q: 'tshirts',
      city: 'Los Angeles',
      recent_days: 14,
      days_of_cover: 7,
      low_stock: 2,
      at_risk: true,
      refresh: true,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_inventory/risk.json')
    assert.equal(qs.get('q'), 'tshirts')
    assert.equal(qs.get('city'), 'Los Angeles')
    assert.equal(qs.get('recent_days'), '14')
    assert.equal(qs.get('days_of_cover'), '7')
    assert.equal(qs.get('low_stock'), '2')
    assert.equal(qs.get('at_risk'), 'true')
    assert.equal(qs.get('refresh'), 'true')
  })

  it('fetches fulfillment recommendations with order item context encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          resource: {id: 'inventory_fulfillment_recommendations', label: 'Inventory Fulfillment Recommendations', columns: []},
          filters: {},
          order_item: {id: 12345},
          location_scope: {label: 'POS', selector: {}, matches: [], warnings: []},
          sku_scope: {label: 'SKU', selector: {}, matches: [], warnings: []},
          summary: {},
          rows: [],
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await inventoryFulfillmentRecommendations(client, {
      order_item_id: 12345,
      all_pos: true,
      include_zero: true,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_inventory/fulfillment_recommendations.json')
    assert.equal(qs.get('order_item_id'), '12345')
    assert.equal(qs.get('all_pos'), 'true')
    assert.equal(qs.get('include_zero'), 'true')
  })
})
