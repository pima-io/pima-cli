import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {flatProductPerformanceRows, flatSalesSummary, flatTeamPerformanceRows, productPerformance, salesSummary, teamPerformance} from '../src/lib/metrics.js'

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

  it('fetches product performance with style selectors encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          metric: 'product_performance',
          group_by: 'style',
          group_label: 'Style',
          sort: 'units',
          limit: 10,
          group_count: 0,
          limited: false,
          range: {from: '2026-06-06', to: '2026-06-06'},
          channel: 'pos',
          location_scope: {label: 'Selected locations', selector: {}, location_ids: [1, 2], matches: [], warnings: []},
          totals: {},
          rows: [],
          source: {model: 'DailySkuPerformanceMetric'},
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await productPerformance(client, {
      date: '2026-06-06',
      location_ids: '1,2',
      channel: 'pos',
      group_by: 'style',
      sort: 'units',
      limit: 10,
      refresh: true,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_metrics/product_performance.json')
    assert.equal(qs.get('date'), '2026-06-06')
    assert.equal(qs.get('location_ids'), '1,2')
    assert.equal(qs.get('channel'), 'pos')
    assert.equal(qs.get('group_by'), 'style')
    assert.equal(qs.get('sort'), 'units')
    assert.equal(qs.get('limit'), '10')
    assert.equal(qs.get('refresh'), 'true')
  })

  it('flattens product performance rows for human output', () => {
    const rows = flatProductPerformanceRows({
      metric: 'product_performance',
      group_by: 'style',
      group_label: 'Style',
      sort: 'revenue',
      limit: 25,
      group_count: 1,
      limited: false,
      range: {from: '2026-06-06', to: '2026-06-06'},
      channel: 'pos',
      location_scope: {label: 'Selected locations', selector: {}, location_ids: [1, 2], matches: [], warnings: []},
      totals: {
        revenue_cents: 12_345,
        return_revenue_cents: 345,
        net_revenue_cents: 12_000,
        units_sold_count: 3,
        returned_units_count: 1,
        return_rate_denominator_count: 4,
        return_rate: 0.25,
        average_unit_revenue_cents: 4115,
      },
      rows: [
        {
          rank: 1,
          id: 42,
          label: 'pima tee',
          group_type: 'product_line',
          revenue_cents: 12_345,
          return_revenue_cents: 345,
          net_revenue_cents: 12_000,
          units_sold_count: 3,
          returned_units_count: 1,
          return_rate_denominator_count: 4,
          return_rate: 0.25,
          average_unit_revenue_cents: 4115,
          entity: {name: 'pima tee'},
        },
      ],
      source: {model: 'DailySkuPerformanceMetric'},
      generated_at: '2026-06-08T00:00:00Z',
    })

    assert.equal(rows[0].style, 'pima tee')
    assert.equal(rows[0].revenue, '$123.45')
    assert.equal(rows[0].net_revenue, '$120.00')
    assert.equal(rows[0].units, 3)
    assert.equal(rows[0].returns, 1)
    assert.equal(rows[0].return_revenue, '$3.45')
    assert.equal(rows[0].return_rate, '25.00%')
    assert.equal(rows[0].auv, '$41.15')
  })

  it('fetches team performance with grouping selectors encoded as query params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          metric: 'team_performance',
          group_by: 'region',
          group_label: 'Location Group',
          sort: 'sales_per_hour',
          limit: 3,
          range: {from: '2026-06-06', to: '2026-06-06'},
          channel: 'pos',
          location_scope: {label: 'All POS locations', selector: {}, location_ids: [1, 2], matches: [], warnings: []},
          product_scope: {label: 'Product filters applied', selector: {q: 'tshirts', category: 'Tees'}, search_terms: ['tshirts', 'tees']},
          totals: {},
          group_count: 0,
          groups: [],
          source: {model: 'OrderItem', supporting_model: 'DailyUserPerformanceMetric'},
          generated_at: '2026-06-08T00:00:00Z',
        }
      },
    } as any

    await teamPerformance(client, {
      date: '2026-06-06',
      group_by: 'region',
      sort: 'sales_per_hour',
      limit: 3,
      city: 'Los Angeles',
      channel: 'pos',
      q: 'tshirts',
      category: 'Tees',
      product_line_id: 42,
      refresh: true,
    })

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_metrics/team_performance.json')
    assert.equal(qs.get('date'), '2026-06-06')
    assert.equal(qs.get('group_by'), 'region')
    assert.equal(qs.get('sort'), 'sales_per_hour')
    assert.equal(qs.get('limit'), '3')
    assert.equal(qs.get('city'), 'Los Angeles')
    assert.equal(qs.get('channel'), 'pos')
    assert.equal(qs.get('q'), 'tshirts')
    assert.equal(qs.get('category'), 'Tees')
    assert.equal(qs.get('product_line_id'), '42')
    assert.equal(qs.get('refresh'), 'true')
  })

  it('flattens team performance groups for human output', () => {
    const rows = flatTeamPerformanceRows({
      metric: 'team_performance',
      group_by: 'region',
      group_label: 'Location Group',
      sort: 'net_sales',
      limit: 3,
      range: {from: '2026-06-06', to: '2026-06-06'},
      channel: 'pos',
      location_scope: {label: 'All POS locations', selector: {}, location_ids: [1, 2], matches: [], warnings: []},
      totals: {
        sold_cents: 12_345,
        returned_cents: 345,
        net_sales_cents: 12_000,
        orders_count: 5,
        units_count: 10,
        hours_worked: 4,
        average_order_value_cents: 2469,
        units_per_transaction: 2,
        average_unit_value_cents: 1235,
        sales_per_hour_cents: 3086,
        net_sales_per_hour_cents: 3000,
      },
      group_count: 1,
      groups: [
        {
          group: {id: 1, label: 'West Coast', type: 'region', location_ids: [1, 2]},
          totals: {
            sold_cents: 12_345,
            returned_cents: 345,
            net_sales_cents: 12_000,
            orders_count: 5,
            units_count: 10,
            hours_worked: 4,
            average_order_value_cents: 2469,
            units_per_transaction: 2,
            average_unit_value_cents: 1235,
            sales_per_hour_cents: 3086,
            net_sales_per_hour_cents: 3000,
          },
          user_count: 1,
          limited: false,
          rows: [
            {
              rank: 1,
              id: 42,
              label: 'Nick Merwin',
              sold_cents: 12_345,
              returned_cents: 345,
              net_sales_cents: 12_000,
              orders_count: 5,
              units_count: 10,
              hours_worked: 4,
              average_order_value_cents: 2469,
              units_per_transaction: 2,
              average_unit_value_cents: 1235,
              sales_per_hour_cents: 3086,
              net_sales_per_hour_cents: 3000,
              user: {username: 'nick'},
            },
          ],
        },
      ],
      source: {model: 'DailyUserPerformanceMetric'},
      generated_at: '2026-06-08T00:00:00Z',
    })

    assert.equal(rows[0].region, 'West Coast')
    assert.equal(rows[0].team_member, 'Nick Merwin')
    assert.equal(rows[0].net_sales, '$120.00')
    assert.equal(rows[0].sales, '$123.45')
    assert.equal(rows[0].returns, '$3.45')
    assert.equal(rows[0].orders, 5)
    assert.equal(rows[0].units, 10)
    assert.equal(rows[0].hours, 4)
    assert.equal(rows[0].sales_per_hour, '$30.86')
    assert.equal(rows[0].net_sales_per_hour, '$30.00')
    assert.equal(rows[0].aov, '$24.69')
    assert.equal(rows[0].auv, '$12.35')
    assert.equal(rows[0].upt, 2)
  })
})
