import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {clearManifestCache, type Manifest} from '../src/lib/manifest.js'
import {verifyMemberActionAccess, verifyResourceAccess} from '../src/lib/access.js'

const HOST = 'https://access.test'

const MANIFEST: Manifest = {
  version: '1',
  gated: true,
  resources: [
    {
      id: 'orders',
      singular: 'order',
      domain: 'orders',
      scopes: {read: 'orders:read', write: 'orders:write'},
      access: {read: true, create: false, update: true, destroy: false},
      paths: {index: '/orders', show: '/orders/{id}'},
      member_actions: [{name: 'cancel', method: 'POST', path: '/orders/{id}/cancel', mutating: true}],
      collection_actions: [],
    },
  ],
}

describe('access verification', () => {
  let originalFetch: typeof fetch

  beforeEach(async () => {
    originalFetch = globalThis.fetch
    process.env.PIMA_HOST = HOST
    process.env.PIMA_TOKEN = 'tok'
    await clearManifestCache(HOST)
    globalThis.fetch = (async () => new Response(JSON.stringify(MANIFEST), {status: 200})) as unknown as typeof fetch
  })

  afterEach(async () => {
    globalThis.fetch = originalFetch
    delete process.env.PIMA_HOST
    delete process.env.PIMA_TOKEN
    await clearManifestCache(HOST)
  })

  it('allows dry-run checks for granted resource verbs', async () => {
    assert.equal((await verifyResourceAccess({resource: 'orders', verb: 'update'})).id, 'orders')
  })

  it('rejects dry-run checks for denied resource verbs', async () => {
    await assert.rejects(() => verifyResourceAccess({resource: 'orders', verb: 'create'}), /does not have create access/)
  })

  it('checks member action visibility and method', async () => {
    assert.equal((await verifyMemberActionAccess({resource: 'orders', action: 'cancel', method: 'POST'})).action.name, 'cancel')
    await assert.rejects(() => verifyMemberActionAccess({resource: 'orders', action: 'cancel', method: 'GET'}), /allows POST/)
  })
})
