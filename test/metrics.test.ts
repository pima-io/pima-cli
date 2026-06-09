import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {flatSalesSummary, salesSummary} from '../src/lib/metrics.js'

describe('metrics helpers', () => {
  it('fetches sales summary with location selectors encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          metric: 'sales_summary',
          range: {from: '2026-06-08', to: '2026-06-08'},
          channel: 'pos',
          location_scope: {label: 'POS locations in CA', location_ids: [1], matches: [], warnings: []},
          totals: {},
          by_location: [],
          source: {model: 'DailyPerformanceMetric'},
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await salesSummary(client, {
      date: '2026-06-08',
      channel: 'pos',
      city: 'Los Angeles',
      state: 'CA',
      all_pos: true,
      refresh: true,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_metrics/sales_summary.json')
    assert.equal(qs.get('date'), '2026-06-08')
    assert.equal(qs.get('channel'), 'pos')
    assert.equal(qs.get('city'), 'Los Angeles')
    assert.equal(qs.get('state'), 'CA')
    assert.equal(qs.get('all_pos'), 'true')
    assert.equal(qs.get('refresh'), 'true')
  })

  it('flattens sales summary for human output', () => {
    const flat = flatSalesSummary({
      metric: 'sales_summary',
      range: {from: '2026-06-08', to: '2026-06-08'},
      channel: 'pos',
      location_scope: {label: 'All POS locations', selector: {}, location_ids: [], matches: [], warnings: []},
      totals: {
        item_revenue_cents: 12345,
        item_returns_cents: 345,
        net_sales_cents: 12000,
        total_revenue_cents: 12500,
        mens_net_sales_cents: 7000,
        womens_net_sales_cents: 5000,
        orders_count: 5,
        units_sold_count: 10,
        average_order_value_cents: 2500,
        average_unit_value_cents: 1235,
        units_per_transaction: 2,
        visits_count: 50,
        conversion_rate: 10,
        new_customers_count: 3,
        sales_per_hour_cents: 4115,
        shipped_from_store_revenue_cents: 2000,
        inventory_on_hand_cents: 90000,
      },
      by_location: [],
      source: {model: 'DailyPerformanceMetric'},
      generated_at: '2026-06-08T00:00:00Z',
    })

    assert.equal(flat.item_revenue, '$123.45')
    assert.equal(flat.item_returns, '$3.45')
    assert.equal(flat.mens_net_sales, '$70.00')
    assert.equal(flat.aov, '$25.00')
    assert.equal(flat.auv, '$12.35')
    assert.equal(flat.conversion_rate, '10.00%')
    assert.equal(flat.ship_from_store, '$20.00')
    assert.equal(flat.upt, 2)
  })
})
