import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {fetchManifest, findResource, type Manifest} from '../src/lib/manifest.js'
import {renderResourceDetail, renderResourcesBriefing} from '../src/lib/manifest-render.js'

const SAMPLE: Manifest = {
  version: '1',
  resources: [
    {
      id: 'orders',
      model: 'Order',
      title: 'Orders',
      singular: 'order',
      domain: 'orders',
      scopes: {read: 'orders:read', write: 'orders:write'},
      supports: {index: true, show: true, create: false, update: true, destroy: false},
      paths: {index: '/orders', show: '/orders/{id}', update: '/orders/{id}'},
      search: {fields: ['number', 'email'], placeholder: 'Search orders'},
      filters: [
        {key: 'status', label: 'Status', type: 'select', choices: [{value: 'open', label: 'Open'}]},
        {key: 'location_id', label: 'Location', type: 'select', options_resource: 'locations'},
      ],
      columns: [{key: 'number', label: 'Number', type: 'string', sortable: true}],
      fields: [
        {key: 'email', label: 'Email', type: 'string', required: true},
        {key: 'note', label: 'Note', type: 'text'},
        {key: 'id', label: 'ID', type: 'integer', read_only: true},
      ],
      views: [{id: 'shippable', title: 'Shippable'}],
      member_actions: [{name: 'cancel', method: 'POST|PATCH', path: '/orders/{id}/cancel'}],
      collection_actions: [{name: 'bulk_edit', method: 'POST', path: '/orders/bulk_edit'}],
    },
    {
      id: 'coupons',
      singular: 'coupon',
      domain: 'pricing',
      scopes: {write: 'pricing:write'},
      supports: {index: true, create: true},
      search: null,
      filters: [],
      fields: [{key: 'code', label: 'Code', type: 'string', required: true}],
      member_actions: [],
      collection_actions: [],
    },
  ],
}

function mockFetch(payload: unknown, calls: string[] = []) {
  return (async (url: string) => {
    calls.push(url)
    return new Response(JSON.stringify(payload), {status: 200, headers: {'content-type': 'application/json'}})
  }) as unknown as typeof fetch
}

describe('manifest fetch + findResource', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    process.env.PIMA_HOST = 'https://manifest.test'
    process.env.PIMA_TOKEN = 'tok'
    originalFetch = globalThis.fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.PIMA_TOKEN
    delete process.env.PIMA_HOST
  })

  it('fetches and parses the manifest from /api_manifest.json (refresh bypasses cache)', async () => {
    const calls: string[] = []
    globalThis.fetch = mockFetch(SAMPLE, calls)

    const manifest = await fetchManifest({refresh: true})
    assert.equal(manifest.version, '1')
    assert.equal(manifest.resources.length, 2)
    assert.equal(calls[0], 'https://manifest.test/api_manifest.json')
  })

  it('findResource resolves by id, singular, and tolerates plural/singular drift', () => {
    assert.equal(findResource(SAMPLE, 'orders')?.id, 'orders')
    assert.equal(findResource(SAMPLE, 'order')?.id, 'orders') // singular
    assert.equal(findResource(SAMPLE, 'coupon')?.id, 'coupons') // singular form
    assert.equal(findResource(SAMPLE, 'COUPONS')?.id, 'coupons') // case-insensitive
    assert.equal(findResource(SAMPLE, 'nope'), undefined)
  })
})

describe('manifest rendering', () => {
  it('renderResourceDetail shows scopes, search, filters, fields, and actions', () => {
    const out = renderResourceDetail(SAMPLE.resources[0])
    assert.match(out, /domain: orders/)
    assert.match(out, /read=orders:read write=orders:write/)
    assert.match(out, /fields: number, email/) // search
    assert.match(out, /status \(select, choices: open\)/) // filter w/ choices
    assert.match(out, /location_id \(select, → locations\)/) // filter w/ options_resource
    assert.match(out, /email \(string, required\)/) // create field
    assert.match(out, /id \(integer, read-only\)/) // read-only field listed separately
    assert.match(out, /cancel \[POST\|PATCH\] \/orders\/\{id\}\/cancel/) // member action
    assert.match(out, /bulk_edit \[POST\] \/orders\/bulk_edit/) // collection action
  })

  it('renderResourcesBriefing groups by domain and lists key params', () => {
    const out = renderResourcesBriefing(SAMPLE)
    assert.match(out, /## orders/)
    assert.match(out, /## pricing/)
    assert.match(out, /### orders/)
    assert.match(out, /search: number, email/)
    assert.match(out, /filters: status, location_id→locations/)
    assert.match(out, /create fields: email\*, note/) // required marked with *
    assert.match(out, /actions: cancel/)
  })
})
