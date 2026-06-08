import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {showResourceExport, startResourceExport} from '../src/lib/resource.js'

describe('resource export helpers', () => {
  it('starts resource exports with index context encoded like the React UI', async () => {
    const calls: string[] = []
    const client = {
      post: async (path: string) => {
        calls.push(path)
        return {export: {id: 7, status: 'pending'}}
      },
    } as any

    const res = await startResourceExport(client, 'customers', {
      q: 'Dolph',
      sort: 'full_name',
      direction: 'asc',
      variant: 'vip',
      legacy_path: '/customers',
      owner_resource: 'companies',
      owner_id: 1,
      filters: {guest: 'true', tag: ['a', 'b'], empty: '', off: false},
      to_email: true,
    })

    assert.equal(res.export.id, 7)
    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/react_ui/resources/customers/export.json')
    assert.equal(qs.get('q'), 'Dolph')
    assert.equal(qs.get('sort'), 'full_name')
    assert.equal(qs.get('direction'), 'asc')
    assert.equal(qs.get('variant'), 'vip')
    assert.equal(qs.get('legacy_path'), '/customers')
    assert.equal(qs.get('owner_resource'), 'companies')
    assert.equal(qs.get('owner_id'), '1')
    assert.equal(qs.get('filters[guest]'), 'true')
    assert.equal(qs.get('filters[tag]'), 'a,b')
    assert.equal(qs.has('filters[empty]'), false)
    assert.equal(qs.has('filters[off]'), false)
    assert.equal(qs.get('to_email'), '1')
  })

  it('loads resource export status', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {export: {id: 7, status: 'completed'}}
      },
    } as any

    const res = await showResourceExport(client, 7)

    assert.equal(calls[0], '/react_ui/exports/7.json')
    assert.equal(res.export.status, 'completed')
  })
})
