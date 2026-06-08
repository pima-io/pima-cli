import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {fetchManifest, findResource, clearManifestCache, type Manifest} from '../src/lib/manifest.js'
import {renderResourceDetail, renderResourcesBriefing, accessCell} from '../src/lib/manifest-render.js'
import {resourceAppUrl} from '../src/lib/links.js'

const SAMPLE: Manifest = {
  version: '1',
  gated: true,
  resources: [
    {
      id: 'orders',
      model: 'Order',
      title: 'Orders',
      singular: 'order',
      domain: 'orders',
      scopes: {read: 'orders:read', write: 'orders:write'},
      access: {read: true, create: false, update: true, destroy: false},
      supports: {index: true, show: true, create: false, update: true, destroy: false},
      paths: {index: '/orders', show: '/orders/{id}', update: '/orders/{id}'},
      search: {fields: ['number', 'email'], placeholder: 'Search orders'},
      filters: [
        {key: 'status', label: 'Status', type: 'select', choices: [{value: 'open', label: 'Open'}]},
        {key: 'location_id', label: 'Location', type: 'select', options_resource: 'locations'},
        {key: 'request_status', label: 'Request Status', type: 'select', views: ['requests']},
        {key: 'damaged', label: 'Damages', type: 'boolean', exclude_views: ['requests']},
      ],
      columns: [{key: 'number', label: 'Number', type: 'string', sortable: true}],
      fields: [
        {key: 'email', label: 'Email', type: 'string', required: true},
        {key: 'note', label: 'Note', type: 'text'},
        {key: 'id', label: 'ID', type: 'integer', read_only: true},
      ],
      views: [{id: 'shippable', title: 'Shippable', path: '/orders/shippable', react_path: '/app/orders/shippable'}],
      member_actions: [
        {name: 'cancel', method: 'POST|PATCH', path: '/orders/{id}/cancel', mutating: true},
        {name: 'invoice', method: 'GET', path: '/orders/{id}/invoice', mutating: false},
      ],
      collection_actions: [{name: 'bulk_edit', method: 'POST', path: '/orders/bulk_edit', mutating: true}],
    },
    {
      id: 'coupons',
      singular: 'coupon',
      domain: 'pricing',
      scopes: {write: 'pricing:write'},
      access: {read: true, create: true, update: true, destroy: true},
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

describe('manifest cache key (per token)', () => {
  // These exercise the real file-store. We use a throwaway host so the only
  // entries we write are `manifest:https://cache.test:*` (never a real token
  // entry, which is keyed by hostname) and we purge them in afterEach.
  const HOST = 'https://cache.test'
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    process.env.PIMA_HOST = HOST
  })
  afterEach(async () => {
    globalThis.fetch = originalFetch
    delete process.env.PIMA_HOST
    delete process.env.PIMA_TOKEN
    await clearManifestCache(HOST)
  })

  it('caches per token: same token re-uses cache, a different token misses', async () => {
    await clearManifestCache(HOST)
    const calls: string[] = []
    globalThis.fetch = mockFetch(SAMPLE, calls)

    process.env.PIMA_TOKEN = 'token-A'
    await fetchManifest({}) // miss -> fetch + cache
    await fetchManifest({}) // hit -> no fetch
    assert.equal(calls.length, 1, 'second call with same token should hit cache')

    // A different token => different fingerprint => cache miss => new fetch.
    process.env.PIMA_TOKEN = 'token-B'
    await fetchManifest({})
    assert.equal(calls.length, 2, 'different token should miss the cache')
  })

  it('clearManifestCache forces a re-fetch for the host (login/logout hook)', async () => {
    await clearManifestCache(HOST)
    const calls: string[] = []
    globalThis.fetch = mockFetch(SAMPLE, calls)

    process.env.PIMA_TOKEN = 'token-A'
    await fetchManifest({})
    await fetchManifest({})
    assert.equal(calls.length, 1)

    await clearManifestCache(HOST)
    await fetchManifest({})
    assert.equal(calls.length, 2, 'cleared cache should re-fetch')
  })
})

describe('manifest rendering', () => {
  it('renderResourceDetail shows scopes, access, search, filters, fields, and actions', () => {
    const out = renderResourceDetail(SAMPLE.resources[0], SAMPLE.gated)
    assert.match(out, /domain: orders/)
    assert.match(out, /read=orders:read write=orders:write/)
    assert.match(out, /manifest: gated/) // gated note from manifest-level flag
    assert.match(out, /access: read ✓\s+create ✗\s+update ✓\s+destroy ✗/) // access block
    assert.match(out, /fields: number, email/) // search
    assert.match(out, /status \(select, choices: open\)/) // filter w/ choices
    assert.match(out, /location_id \(select, → locations\)/) // filter w/ options_resource
    assert.match(out, /request_status \(select, views: requests\)/) // filter scoped to a view
    assert.match(out, /damaged \(boolean, except: requests\)/) // filter excluded from a view
    assert.match(out, /email \(string, required\)/) // create field
    assert.match(out, /id \(integer, read-only\)/) // read-only field listed separately
    assert.match(out, /cancel \[POST\|PATCH\] \/orders\/\{id\}\/cancel \[mutating\]/) // mutating action
    assert.match(out, /invoice \[GET\] \/orders\/\{id\}\/invoice \[read-only\]/) // non-mutating action
    assert.match(out, /bulk_edit \[POST\] \/orders\/bulk_edit \[mutating\]/) // collection action
  })

  it('resourceAppUrl builds direct app URLs for records, views, and filters', () => {
    const resource = SAMPLE.resources[0]

    assert.equal(resourceAppUrl('https://pima.io', resource, {id: 12}), 'https://pima.io/app/orders/12')
    assert.equal(
      resourceAppUrl('https://pima.io/', resource, {
        variant: 'shippable',
        q: 'priority',
        filters: {status: 'pending'},
      }),
      'https://pima.io/app/orders/shippable?q=priority&filters%5Bstatus%5D=pending',
    )
  })

  it('accessCell renders a compact r/c/u/d indicator', () => {
    assert.equal(accessCell({read: true, create: false, update: true, destroy: false}), 'r-u-')
    assert.equal(accessCell({read: true, create: true, update: true, destroy: true}), 'rcud')
    assert.equal(accessCell(undefined), '?')
  })

  it('renderResourcesBriefing groups by domain, notes gating, and lists access + key params', () => {
    const out = renderResourcesBriefing(SAMPLE)
    assert.match(out, /GATED/) // gated note in the header
    assert.match(out, /## orders/)
    assert.match(out, /## pricing/)
    assert.match(out, /### orders/)
    assert.match(out, /access: r-u- \(r\/c\/u\/d\)/) // per-resource access cell
    assert.match(out, /search: number, email/)
    assert.match(out, /filters: status, location_id→locations, request_status@requests, damaged!requests/)
    assert.match(out, /create fields: email\*, note/) // required marked with *
    assert.match(out, /actions: cancel!/) // mutating actions marked with !
  })
})
