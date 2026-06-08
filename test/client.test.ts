import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {Client} from '../src/lib/client.js'

describe('Client', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    process.env.PIMA_HOST = 'https://x.test'
    process.env.PIMA_TOKEN = 'tok'
    originalFetch = globalThis.fetch
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.PIMA_TOKEN
    delete process.env.PIMA_HOST
  })

  it('sends the bearer token and X-Pima-View: lean on every request', async () => {
    const calls: Array<[string, any]> = []
    globalThis.fetch = (async (url: string, opts: any) => {
      calls.push([url, opts])
      return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}})
    }) as unknown as typeof fetch

    const client = await Client.create()
    const res = await client.get('/orders.json')

    assert.deepEqual(res, {ok: true})
    assert.equal(calls[0][0], 'https://x.test/orders.json')
    assert.equal(calls[0][1].headers['X-Pima-View'], 'lean')
    assert.equal(calls[0][1].headers.Authorization, 'Bearer tok')
  })

  it('raises ApiError on a non-2xx response', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({error: 'nope', message: 'Readable API error'}), {status: 403})) as unknown as typeof fetch

    const client = await Client.create()
    await assert.rejects(client.get('/x.json'), (error: any) => error.status === 403 && error.message === 'Readable API error')
  })
})
