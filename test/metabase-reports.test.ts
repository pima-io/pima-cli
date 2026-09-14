import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
  filterMetabaseReports,
  metabaseReport,
  metabaseReports,
  renderMetabaseReport,
  type MetabaseReport,
} from '../src/lib/metabase-reports.js'

const fleet: MetabaseReport = {
  id: 'fleet_report',
  title: 'Fleet',
  category: 'sales_performance',
  pima_path: '/reports/fleet_report',
  classic_fallback: false,
  availability: 'available',
  filters: [{pima_key: 'date_range', metabase_parameters: ['date_start', 'date_end'], supported: true}],
  metabase: {
    type: 'question',
    id: 321,
    parity_status: 'verified',
    semantic_version: 3,
    url: 'https://metabase.example.test/question/321-pima-fleet',
  },
  building_blocks: [
    {
      id: 'fleet_sales_items',
      title: 'Fleet Sales Items',
      kind: 'model',
      card_id: 123,
      grain: 'order_item_id',
      reference: '{{#123-pima-fleet-sales-items}}',
    },
  ],
}

describe('Metabase report catalog helpers', () => {
  it('fetches the report list and one report', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return path.endsWith('/reports.json') ? {reports: [fleet]} : {report: fleet}
      },
    } as any

    assert.deepEqual(await metabaseReports(client), [fleet])
    assert.deepEqual(await metabaseReport(client, 'fleet report'), fleet)
    assert.deepEqual(calls, ['/api_metabase/reports.json', '/api_metabase/reports/fleet%20report.json'])
  })

  it('filters by availability and building block text', () => {
    const planned = {...fleet, id: 'product_report', title: 'Product Overview', availability: 'planned', building_blocks: []}

    assert.deepEqual(filterMetabaseReports([fleet, planned], {available: true}), [fleet])
    assert.deepEqual(filterMetabaseReports([fleet, planned], {match: 'sales items'}), [fleet])
  })

  it('renders the canonical card, filters, and custom SQL guidance', () => {
    const rendered = renderMetabaseReport(fleet)

    assert.match(rendered, /Metabase: https:\/\/metabase\.example\.test\/question\/321-pima-fleet/)
    assert.match(rendered, /date_range -> date_start \+ date_end/)
    assert.match(rendered, /\{\{#123-pima-fleet-sales-items\}\}/)
    assert.match(rendered, /apply the report filters in the outer query/)
  })
})
