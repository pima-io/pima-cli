import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {inventoryAvailability, inventoryTransfers} from '../src/lib/inventory.js'

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
})
