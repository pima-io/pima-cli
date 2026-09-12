import assert from 'node:assert/strict'
import {afterEach, beforeEach, describe, it} from 'node:test'
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createServer} from 'node:http'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {erasureResultsCsv, parseErasureCsv, previewErasurePlan, readErasureCsv, readErasurePlan, runErasurePlan, writeErasureFile, type ErasureStatus} from '../src/lib/customer-erasure.js'

const run = promisify(execFile)
const status = (customerId: number): ErasureStatus => ({customer_id: customerId, company_id: 1,
  shopify_customer_id: `${customerId}`, pima_status: 'not_removed', shopify_status: 'unknown', request_ids: [], removed_at: null})

describe('CLI customer erasure orchestration', () => {
  let directory: string
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'pima-erasure-')) })
  afterEach(async () => { await rm(directory, {recursive: true, force: true}) })

  it('parses OneTrust banners, quoted fields and duplicates without losing source request IDs', () => {
    const entries = parseErasureCsv('\uFEFFOneTrust export\n\nBanner\n\n\n\nRequest ID,Email,Notes\n"REQ,1", A@Example.com ,"two\nlines"\nREQ-2,a@example.com,test\nREQ-3,invalid,test\n')
    assert.equal(entries.length, 2)
    assert.equal(entries[0].email, 'a@example.com')
    assert.deepEqual(entries[0].rows, [{row: 8, request_id: 'REQ,1'}, {row: 9, request_id: 'REQ-2'}])
    assert.equal(entries[1].match, 'invalid')
    assert.equal(parseErasureCsv('Contact,Ticket\na@example.com,R1', {emailColumn: 'Contact', requestIdColumn: 'Ticket'})[0].rows[0].request_id, 'R1')
    for (const csv of ['Email,Email\na@example.com,b@example.com', 'Email,Request ID\na@example.com,R,extra', 'Email\n"unclosed']) {
      assert.throws(() => parseErasureCsv(csv))
    }
    assert.throws(() => parseErasureCsv('Email\n' + 'a@example.com\n'.repeat(10001)), /10,000/)
  })

  it('reports ambiguous missing and orphan matches and saves owner-only local evidence', async () => {
    const calls: string[] = []
    const client = {host: 'https://pima.test', async post<T>(path: string, body: any): Promise<T> {
      assert.equal(path, '/customers/removal_lookup.json')
      calls.push(body.removal_email)
      const matches = body.removal_email === 'duplicate@example.com' ? [status(1), status(2)] :
        body.removal_email === 'orphan@example.com' ? [{...status(3), customer_id: null, pima_status: 'removed'}] : []
      return {company_id: 1, matches} as T
    }, async get<T>(): Promise<T> { throw new Error('Unexpected GET') }}
    const plan = await previewErasurePlan(client, 'Email,Request ID\nduplicate@example.com,ONE\nDUPLICATE@example.com,TWO\nmissing@example.com,THREE\norphan@example.com,FOUR\ninvalid,FIVE\n')
    assert.equal(calls.length, 3)
    assert.deepEqual(plan.entries.map(entry => entry.match), ['ambiguous', 'missing', 'removed_without_customer', 'invalid'])
    const path = join(directory, 'plan.json')
    await writeErasureFile(path, JSON.stringify(plan))
    assert.equal((await stat(path)).mode & 0o777, 0o600)
    assert.deepEqual(await readErasurePlan(path), plan)
    await assert.rejects(writeErasureFile(path, 'replacement'), {code: 'EEXIST'})
    const invalid = join(directory, 'invalid.csv')
    await writeFile(invalid, Buffer.from([0xff, 0xfe]))
    await assert.rejects(readErasureCsv(invalid), /UTF-8 CSV/)
    plan.entries[0].rows[0].request_id = '=IMPORT("url")'
    const csv = erasureResultsCsv(plan)
    assert(!csv.includes('@example.com'))
    assert(csv.includes("'=IMPORT"))
    assert.equal(csv.split('\n').length, 7)
  })

  it('bounds parallel calls and reconciles a lost response without repeating accepted requests', async () => {
    const states = new Map<number, ErasureStatus>([1, 2, 3].map(id => [id, status(id)]))
    const posts: number[] = []
    let active = 0
    let maximum = 0
    let lost = true
    const client = {host: 'https://pima.test', async post<T>(path: string, body: any): Promise<T> {
      if (path.includes('lookup')) {
        const id = Number(body.removal_email[0])
        return {company_id: 1, matches: [states.get(id)]} as T
      }
      const id = Number(path.split('/')[2])
      assert.equal(body.expected_email, `${id}@example.com`)
      active++
      maximum = Math.max(maximum, active)
      await new Promise(resolve => setTimeout(resolve, 10))
      active--
      posts.push(id)
      const result: ErasureStatus = {...status(id), pima_status: 'removed', shopify_status: 'submitted', request_ids: body.request_ids, removed_at: new Date().toISOString()}
      states.set(id, result)
      if (id === 2 && lost) { lost = false; throw new Error('Connection lost after commit') }
      return {data_removal: result} as T
    }, async get<T>(path: string): Promise<T> { return states.get(Number(path.split('/')[2])) as T }}
    const plan = await previewErasurePlan(client, 'Email,Request ID\n1@example.com,ONE\n2@example.com,TWO\n3@example.com,THREE\n')
    const path = join(directory, 'plan.json')
    await writeErasureFile(path, JSON.stringify(plan))
    await assert.rejects(runErasurePlan({...client, host: 'https://other.test'}, path, {submit: true}), /different PIMA host/)
    assert.equal(posts.length, 0)
    const first = await runErasurePlan(client, path, {submit: true, concurrency: 2})
    assert.equal(maximum, 2)
    assert(first.entries[1].error?.includes('Connection lost'))
    assert.equal((await readErasurePlan(path)).entries[1].error, first.entries[1].error)
    const resumed = await runErasurePlan(client, path, {submit: true})
    assert.equal(posts.length, 3)
    assert(resumed.entries.every(entry => !entry.error && entry.result?.shopify_status === 'submitted'))
    await runErasurePlan(client, path)
    assert.equal(posts.length, 3, 'status is read only')
    await writeFile(`${path}.lock`, '')
    await assert.rejects(runErasurePlan(client, path, {submit: true}), /Cannot lock plan/)
    assert.equal(posts.length, 3)
  })

  it('never submits a customer when status returns a different company', async () => {
    let posts = 0
    const client = {host: 'https://pima.test', async post<T>(): Promise<T> {
      posts++
      return {company_id: 1, matches: [status(1)]} as T
    }, async get<T>(): Promise<T> { return {...status(1), company_id: 2} as T }}
    const plan = await previewErasurePlan(client, 'Email\n1@example.com')
    const path = join(directory, 'plan.json')
    await writeErasureFile(path, JSON.stringify(plan))
    const result = await runErasurePlan(client, path, {submit: true})
    assert.equal(posts, 1)
    assert.match(result.entries[0].error || '', /different customer or company/)
  })

  it('runs preview submit resume and status through real CLI commands and the HTTP client', async () => {
    const calls: Array<{method?: string; path?: string; body: any}> = []
    let result = status(1)
    const server = createServer(async (req, res) => {
      let raw = ''
      for await (const chunk of req) raw += chunk.toString()
      const body = raw ? JSON.parse(raw) : null
      calls.push({method: req.method, path: req.url, body})
      assert.equal(req.headers.authorization, 'Bearer erasure-fixture-token')
      if (req.url?.includes('remove_personal_data')) result = {...result, pima_status: 'removed', shopify_status: 'not_required', request_ids: body.request_ids, removed_at: new Date().toISOString()}
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(req.url?.includes('lookup') ? {company_id: 1, matches: [result]} : req.method === 'POST' ? {data_removal: result} : result))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert(address && typeof address === 'object')
    const host = `http://127.0.0.1:${address.port}`
    const env = {...process.env, PIMA_HOST: host, PIMA_TOKEN: 'erasure-fixture-token'}
    const csv = join(directory, 'requests.csv'), plan = join(directory, 'plan.json'), results = join(directory, 'results.csv')
    await writeFile(csv, 'Email,Request ID\na@example.com,REQ-1\n')
    const cli = (...args: string[]) => run(process.execPath, ['bin/dev.js', 'customer', 'erasure', ...args], {env})
    try {
      await cli('preview', csv, '--out', plan)
      assert.equal(calls.length, 1)
      await cli('submit', plan)
      assert.equal(calls.length, 1, 'without --yes no removal or status request is made')
      await cli('submit', plan, '--yes', '--concurrency', '2')
      await cli('resume', plan, '--yes')
      assert.equal(calls.filter(call => call.path?.includes('remove_personal_data')).length, 1)
      assert.deepEqual(calls.find(call => call.path?.includes('remove_personal_data'))?.body, {expected_email: 'a@example.com', request_ids: ['REQ-1']})
      await cli('status', plan, '--out', results)
      assert.equal(await readFile(results, 'utf8'), erasureResultsCsv(await readErasurePlan(plan)))
      await assert.rejects(cli('preview', csv, '--out', plan), /Output file already exists/)
      assert.equal(calls.length, 5)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
