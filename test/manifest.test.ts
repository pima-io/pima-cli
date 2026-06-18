import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {fetchManifest, findResource, clearManifestCache, type Manifest} from '../src/lib/manifest.js'
import {renderResourceDetail, renderResourcesBriefing, accessCell} from '../src/lib/manifest-render.js'
import {resourceAppUrl} from '../src/lib/links.js'

const SAMPLE: Manifest = {
  version: '3',
  gated: true,
  resources: [
    {
      id: 'orders',
      model: 'Order',
      controller_contract: {
        name: 'OrdersController',
        path: 'orders',
        resource_id: 'orders',
        declared_resource_docs: true,
        documented_params: ['status'],
        documented_actions: ['cancel'],
        parameters: {
          query: [
            {key: 'q', type: 'string', description: 'Text search across number, email.'},
            {key: 'sort', type: 'enum', description: 'Sortable column key.', choices: ['number']},
          ],
          filters: [{key: 'status', label: 'Status', type: 'select', param_key: 'filters[status]'}],
          owner: [{key: 'customer_id', placeholder: ':customer_id', owner: true, resource: 'customers', required: true}],
        },
        non_crud_actions: {
          member: [{name: 'cancel', method: 'POST|PATCH', path: '/orders/{id}/cancel', mutating: true}],
          collection: [],
        },
      },
      model_contract: {
        name: 'Order',
        table_name: 'orders',
        primary_key: 'id',
        timestamp_columns: ['created_at', 'updated_at'],
        paper_trail_history: true,
        comments: true,
        agent_docs: {summary: 'Orders model records are exposed through the gated resource manifest.'},
      },
      title: 'Orders',
      singular: 'order',
      domain: 'orders',
      scopes: {read: 'orders:read', write: 'orders:write'},
      access: {read: true, create: false, update: true, destroy: false},
      capabilities: {index: true, show: true, history: true, comments: true, export: true},
      supports: {index: true, show: true, create: false, update: true, destroy: false},
      paths: {index: '/orders', show: '/orders/{id}', update: '/orders/{id}'},
      search: {fields: ['number', 'email'], placeholder: 'Search orders'},
      filters: [
        {
          key: 'status',
          label: 'Status',
          type: 'select',
          description: 'Filter by order status.',
          param_key: 'filters[status]',
          examples: ['open'],
          choices: [{value: 'open', label: 'Open'}],
        },
        {key: 'location_id', label: 'Location', type: 'select', options_resource: 'locations'},
        {key: 'request_status', label: 'Request Status', type: 'select', views: ['requests']},
        {key: 'damaged', label: 'Damages', type: 'boolean', exclude_views: ['requests']},
      ],
      query_contract: {
        params: [
          {key: 'q', type: 'string', description: 'Text search across number, email.', examples: ['123']},
          {key: 'sort', type: 'enum', description: 'Sortable column key.', choices: ['number']},
        ],
      },
      owner_params: [{key: 'customer_id', placeholder: ':customer_id', owner: true, resource: 'customers', required: true}],
      columns: [{key: 'number', label: 'Number', type: 'string', sortable: true}],
      fields: [
        {key: 'email', label: 'Email', type: 'string', required: true, description: 'Customer email.'},
        {key: 'note', label: 'Note', type: 'text'},
        {key: 'id', label: 'ID', type: 'integer', read_only: true},
      ],
      views: [{id: 'shippable', title: 'Shippable', path: '/orders/shippable', react_path: '/app/orders/shippable'}],
      member_actions: [
        {
          name: 'cancel',
          method: 'POST|PATCH',
          path: '/orders/{id}/cancel',
          mutating: true,
          agent_docs: {
            summary: 'Cancel order.',
            requires_confirmation: true,
            dry_run_supported: true,
            side_effects: ['Changes order state.'],
            failure_modes: ['403 without orders:write.'],
          },
        },
        {name: 'invoice', method: 'GET', path: '/orders/{id}/invoice', mutating: false},
      ],
      collection_actions: [{name: 'bulk_edit', method: 'POST', path: '/orders/bulk_edit', mutating: true}],
      agent_docs: {
        summary: 'Orders API resource backed by Order.',
        business_terms: ['orders', 'order'],
        when_to_use: ['Use this resource for record-level questions about orders.'],
        avoid_when: ['For aggregate sales questions, prefer metrics sales.'],
        examples: [{description: 'Describe the contract', cli: 'pima resource describe orders'}],
      },
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
    assert.equal(manifest.version, '3')
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

describe('manifest cache key (per token)', {concurrency: false}, () => {
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
    assert.match(out, /model contract: table=orders pk=id timestamps=created_at\|updated_at/)
    assert.match(out, /model docs: Orders model records are exposed through the gated resource manifest/)
    assert.match(out, /controller: OrdersController\s+path=orders resource-docs params=q\|sort\|filters\[status\]\|customer_id actions=cancel/)
    assert.match(out, /capabilities: index, show, history, comments, export/)
    assert.match(out, /AGENT GUIDANCE:/)
    assert.match(out, /Orders API resource backed by Order/)
    assert.match(out, /fields: number, email/) // search
    assert.match(out, /status as filters\[status\] \(select, choices: open\)/) // filter w/ choices
    assert.match(out, /location_id \(select, → locations\)/) // filter w/ options_resource
    assert.match(out, /request_status \(select, views: requests\)/) // filter scoped to a view
    assert.match(out, /damaged \(boolean, except: requests\)/) // filter excluded from a view
    assert.match(out, /q \(string\).*Text search across number, email/) // query params with docs
    assert.match(out, /customer_id \(:customer_id\) \[required, owner, → customers\]/) // owner path params
    assert.match(out, /email \(string, required\)/) // create field
    assert.match(out, /id \(integer, read-only\)/) // read-only field listed separately
    assert.match(out, /cancel \[POST\|PATCH\] \/orders\/\{id\}\/cancel \[mutating\] \(confirmation, dry-run\).*Cancel order/) // mutating action
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
    assert.match(out, /docs: Orders API resource backed by Order/)
    assert.match(out, /capabilities: index, show, history, comments, export/)
    assert.match(out, /search: number, email/)
    assert.match(out, /filters: status, location_id→locations, request_status@requests, damaged!requests/)
    assert.match(out, /create fields: email\*, note/) // required marked with *
    assert.match(out, /actions: cancel!/) // mutating actions marked with !
  })
})
