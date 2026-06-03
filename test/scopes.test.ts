import {describe, it, expect} from 'vitest'
import {ALL_SCOPES, READ_ONLY, DOMAINS} from '../src/lib/scopes.js'

describe('scopes', () => {
  it('exposes read+write for every domain', () => {
    expect(ALL_SCOPES.length).toBe(DOMAINS.length * 2)
    expect(ALL_SCOPES).toContain('orders:read')
    expect(ALL_SCOPES).toContain('orders:write')
  })

  it('read_only is every domain read scope', () => {
    expect(READ_ONLY.every((s) => s.endsWith(':read'))).toBe(true)
    expect(READ_ONLY).toContain('orders:read')
  })

  it('includes transfers as its own domain', () => {
    expect(DOMAINS).toContain('transfers')
    expect(DOMAINS.length).toBe(10)
  })
})
