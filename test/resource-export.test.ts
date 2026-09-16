import {after, before, describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {downloadExport, waitForExport} from '../src/lib/resource-export.js'
import {previewResourceExport, startResourceExport} from '../src/lib/resource.js'

describe('contact export requests', () => {
  it('preserves the same selectors and owner in preview and generation', async () => {
    const calls: string[] = []
    const client = {get: async (path: string) => {calls.push(path); return {}}, post: async (path: string) => {calls.push(path); return {}}} as any
    const params = {preset: 'order_contacts' as const, filters: {product_ids: [13, 14], sku_prefixes: 'BM17305.1609RIN', fulfillment: 'awaiting'}, owner_resource: 'customers', owner_id: 5}
    await previewResourceExport(client, 'orders', params)
    await startResourceExport(client, 'orders', params)
    assert.ok(calls[0].startsWith('/react_ui/resources/orders/export_preview.json?'))
    for (const call of calls) {
      const query = new URLSearchParams(call.split('?')[1])
      assert.equal(query.get('preset'), 'order_contacts')
      assert.equal(query.get('filters[product_ids]'), '13,14')
      assert.equal(query.get('filters[sku_prefixes]'), 'BM17305.1609RIN')
      assert.equal(query.get('filters[fulfillment]'), 'awaiting')
      assert.equal(query.get('owner_id'), '5')
    }
  })

  it('waits through processing and propagates a failed job', async () => {
    const statuses = ['processing', 'completed']
    const result = await waitForExport(async () => ({export: {id: 1, status: statuses.shift()!}}), {id: 1, status: 'pending'}, 1, 1000)
    assert.equal(result.export.status, 'completed')
    await assert.rejects(waitForExport(async () => ({export: {id: 1, status: 'failed', error_message: 'No matching SKUs'}}), {id: 1, status: 'pending'}, 1, 1000), /No matching SKUs/)
  })
})

describe('export downloads', () => {
  let base: string
  let directory: string
  let receivedAuthorization: string | undefined
  const server = createServer((request, response) => {
    receivedAuthorization = request.headers.authorization
    if (request.url === '/error') {response.writeHead(403); response.end('Expired'); return}
    response.setHeader('content-type', request.url === '/html' ? 'text/html' : request.url === '/file.zip' ? 'application/zip' : 'text/csv')
    response.end('Email\nfixture@example.com\n')
  })
  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pima-export-test-'))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as any).port}`
  })
  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, {recursive: true, force: true})
  })

  it('writes the exact file privately without forwarding API credentials', async () => {
    const path = join(directory, 'emails.csv')
    assert.equal(await downloadExport({id: 1, status: 'completed', file_url: `${base}/file.csv`}, path), path)
    assert.equal(await readFile(path, 'utf8'), 'Email\nfixture@example.com\n')
    assert.equal((await stat(path)).mode & 0o777, 0o600)
    assert.equal(receivedAuthorization, undefined)
  })

  it('preserves existing files', async () => {
    const path = join(directory, 'existing.csv')
    await writeFile(path, 'keep me')
    await assert.rejects(downloadExport({id: 41, status: 'completed', file_url: `${base}/file.csv`}, path), (error: Error) => {
      assert.match(error.message, /EEXIST/)
      assert.match(error.message, /pima resource export-status 41/)
      assert.match(error.message, /--output/)
      return true
    })
    assert.equal(await readFile(path, 'utf8'), 'keep me')
  })

  it('rejects incomplete, expired, HTML, and ZIP-as-CSV downloads', async () => {
    const path = join(directory, 'invalid.csv')
    await assert.rejects(downloadExport({id: 1, status: 'pending'}, path), /not complete/)
    for (const [endpoint, message] of [['/error', /403/], ['/html', /HTML/], ['/file.zip', /ZIP/]] as const) {
      await assert.rejects(downloadExport({id: 42, status: 'completed', file_url: `${base}${endpoint}`}, path), (error: Error) => {
        assert.match(error.message, message)
        assert.match(error.message, /pima resource export-status 42/)
        return true
      })
    }
    await assert.rejects(stat(path), /ENOENT/)
  })
})
