import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {Client} from '../src/lib/client.js'

describe('Client', () => {
  beforeEach(() => {
    process.env.PIMA_HOST = 'https://x.test'
    process.env.PIMA_TOKEN = 'tok'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.PIMA_TOKEN
    delete process.env.PIMA_HOST
  })

  it('sends the bearer token and X-Pima-View: lean on every request', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}}),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = await Client.create()
    const res = await client.get('/orders.json')

    expect(res).toEqual({ok: true})
    const [url, opts] = fetchMock.mock.calls[0] as [string, any]
    expect(url).toBe('https://x.test/orders.json')
    expect(opts.headers['X-Pima-View']).toBe('lean')
    expect(opts.headers.Authorization).toBe('Bearer tok')
  })

  it('raises ApiError on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({error: 'nope'}), {status: 403})),
    )
    const client = await Client.create()
    await expect(client.get('/x.json')).rejects.toMatchObject({status: 403})
  })
})
