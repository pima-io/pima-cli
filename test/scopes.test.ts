import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {ALL_SCOPES, READ_ONLY, DOMAINS} from '../src/lib/scopes.js'

describe('scopes', () => {
  it('exposes read+write for every domain', () => {
    assert.equal(ALL_SCOPES.length, DOMAINS.length * 2)
    assert.ok(ALL_SCOPES.includes('orders:read'))
    assert.ok(ALL_SCOPES.includes('orders:write'))
  })

  it('read_only is every domain read scope', () => {
    assert.ok(READ_ONLY.every((s) => s.endsWith(':read')))
    assert.ok(READ_ONLY.includes('orders:read'))
  })

  it('includes transfers and feedback as their own domains', () => {
    assert.ok(DOMAINS.includes('transfers'))
    assert.ok(DOMAINS.includes('feedback'))
  })
})
