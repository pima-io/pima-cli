import {describe, it, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert/strict'
import {deleteToken, writeToken} from '../src/lib/auth.js'
import {Client} from '../src/lib/client.js'

describe('Client', () => {
  const REFRESH_HOST = 'https://refresh.test'
  let originalFetch: typeof fetch

  beforeEach(() => {
    process.env.PIMA_HOST = 'https://x.test'
    process.env.PIMA_TOKEN = 'tok'
    originalFetch = globalThis.fetch
  })
  afterEach(async () => {
    globalThis.fetch = originalFetch
    delete process.env.PIMA_TOKEN
    delete process.env.PIMA_HOST
    await deleteToken(REFRESH_HOST)
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

  it('refreshes a stored token before it expires', async () => {
    delete process.env.PIMA_TOKEN
    process.env.PIMA_HOST = REFRESH_HOST
    await writeToken(REFRESH_HOST, {
      access_token: 'old-access',
      refresh_token: 'old-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 60,
      scopes: ['orders:read'],
    })

    const calls: Array<[string, any]> = []
    globalThis.fetch = (async (url: string, opts: any) => {
      calls.push([url, opts])
      if (url === `${REFRESH_HOST}/oauth/token`) {
        assert.equal(opts.method, 'POST')
        assert.match(opts.body.toString(), /grant_type=refresh_token/)
        assert.match(opts.body.toString(), /refresh_token=old-refresh/)
        return new Response(JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          scope: 'orders:read',
        }), {status: 200, headers: {'content-type': 'application/json'}})
      }

      assert.equal(url, `${REFRESH_HOST}/orders.json`)
      assert.equal(opts.headers.Authorization, 'Bearer new-access')
      return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}})
    }) as unknown as typeof fetch

    const client = await Client.create()
    const res = await client.get('/orders.json')

    assert.deepEqual(res, {ok: true})
    assert.deepEqual(calls.map(([url]) => url), [`${REFRESH_HOST}/oauth/token`, `${REFRESH_HOST}/orders.json`])
  })

  it('retries once with a refreshed token after a 401', async () => {
    delete process.env.PIMA_TOKEN
    process.env.PIMA_HOST = REFRESH_HOST
    await writeToken(REFRESH_HOST, {
      access_token: 'stale-access',
      refresh_token: 'retry-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scopes: ['orders:read'],
    })

    const calls: Array<[string, any]> = []
    globalThis.fetch = (async (url: string, opts: any) => {
      calls.push([url, opts])
      if (url === `${REFRESH_HOST}/oauth/token`) {
        assert.match(opts.body.toString(), /refresh_token=retry-refresh/)
        return new Response(JSON.stringify({
          access_token: 'retried-access',
          refresh_token: 'next-refresh',
          expires_in: 3600,
          scope: 'orders:read',
        }), {status: 200, headers: {'content-type': 'application/json'}})
      }

      assert.equal(url, `${REFRESH_HOST}/orders.json`)
      if (calls.filter(([calledUrl]) => calledUrl === `${REFRESH_HOST}/orders.json`).length === 1) {
        assert.equal(opts.headers.Authorization, 'Bearer stale-access')
        return new Response(JSON.stringify({error: 'invalid_token'}), {status: 401, headers: {'content-type': 'application/json'}})
      }

      assert.equal(opts.headers.Authorization, 'Bearer retried-access')
      return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}})
    }) as unknown as typeof fetch

    const client = await Client.create()
    const res = await client.get('/orders.json')

    assert.deepEqual(res, {ok: true})
    assert.deepEqual(calls.map(([url]) => url), [
      `${REFRESH_HOST}/orders.json`,
      `${REFRESH_HOST}/oauth/token`,
      `${REFRESH_HOST}/orders.json`,
    ])
  })
})
