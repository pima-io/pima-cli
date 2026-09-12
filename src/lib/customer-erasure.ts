import {open, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {parse} from 'csv-parse/sync'
import {z} from 'zod'

const id = z.number().int().positive().safe()
const statusSchema = z.object({
  customer_id: id.nullable(), company_id: id, shopify_customer_id: z.string().nullable(),
  pima_status: z.enum(['removed', 'not_removed']),
  shopify_status: z.enum(['pending', 'submitted', 'failed', 'not_required', 'unknown']),
  request_ids: z.array(z.string()), removed_at: z.string().nullable(),
  shopify_requested_at: z.string().nullable().optional(), error_class: z.string().nullable().optional(),
})
const entrySchema = z.object({
  email: z.string(), rows: z.array(z.object({row: id, request_id: z.string().nullable()})).min(1),
  match: z.enum(['matched', 'missing', 'invalid', 'ambiguous', 'removed_without_customer']),
  customer_id: id.nullable(), candidate_customer_ids: z.array(id),
  result: statusSchema.optional(), error: z.string().optional(),
})
const planSchema = z.object({
  format: z.literal('pima-customer-erasure-plan/v2'), host: z.string().url(), company_id: id,
  entries: z.array(entrySchema).min(1).max(10000),
})
export type ErasureStatus = z.infer<typeof statusSchema>
export type ErasureEntry = z.infer<typeof entrySchema>
export type ErasurePlan = z.infer<typeof planSchema>
interface ErasureClient {
  host: string
  post<T = any>(path: string, body?: unknown): Promise<T>
  get<T = any>(path: string): Promise<T>
}
export const MAX_CSV_BYTES = 10 * 1024 * 1024

export async function readErasureCsv(path: string): Promise<string> {
  const bytes = await readFile(path)
  if (bytes.length > MAX_CSV_BYTES) throw new Error('CSV is limited to 10 MB.')
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes)
  } catch {
    throw new Error('Input must be a UTF-8 CSV. Export the workbook as CSV first.')
  }
}

export function parseErasureCsv(csv: string, columns: {emailColumn?: string; requestIdColumn?: string} = {}): ErasureEntry[] {
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) throw new Error('CSV is limited to 10 MB.')
  // Banner rows may have different widths; enforce the header width on all data rows below.
  const records: string[][] = parse(csv, {bom: true, relax_column_count: true})
  const header = (value: string): string => value.trim().toLowerCase().replace(/[_\s]+/g, ' ')
  const emails = columns.emailColumn ? [header(columns.emailColumn)] : ['email', 'email address', 'data subject email']
  const headerIndex = records.slice(0, 20).findIndex(row => row.some(cell => emails.includes(header(cell))))
  if (headerIndex < 0) throw new Error('Email header was not found within the first 20 CSV rows.')
  const headers = records[headerIndex].map(header)
  const emailIndexes = headers.flatMap((cell, index) => emails.includes(cell) ? [index] : [])
  const requestHeader = header(columns.requestIdColumn || 'Request ID')
  const requestIndexes = headers.flatMap((cell, index) => cell === requestHeader ? [index] : [])
  if (emailIndexes.length !== 1 || requestIndexes.length > 1) throw new Error('CSV has duplicate email or request ID headers.')
  if (columns.requestIdColumn && !requestIndexes.length) throw new Error('Request ID header override was not found.')
  const entries: ErasureEntry[] = []
  const byEmail = new Map<string, ErasureEntry>()
  let rows = 0
  for (let index = headerIndex + 1; index < records.length; index++) {
    const record = records[index]
    if (record.every(cell => !cell.trim())) continue
    if (++rows > 10000) throw new Error('CSV is limited to 10,000 data rows.')
    if (record.length !== headers.length) throw new Error(`CSV row ${index + 1} has a different number of columns than the header.`)
    const email = record[emailIndexes[0]].trim().toLowerCase()
    const source = {row: index + 1, request_id: record[requestIndexes[0]]?.trim() || null}
    const prior = email ? byEmail.get(email) : undefined
    if (prior) {
      prior.rows.push(source)
    } else {
      const entry: ErasureEntry = {
        email, rows: [source], match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'missing' : 'invalid',
        customer_id: null, candidate_customer_ids: [],
      }
      entries.push(entry)
      if (email) byEmail.set(email, entry)
    }
  }
  if (!entries.length) throw new Error('CSV contains no customer rows.')
  return entries
}

export async function previewErasurePlan(client: ErasureClient, csv: string, columns = {}): Promise<ErasurePlan> {
  const entries = parseErasureCsv(csv, columns)
  let companyId: number | undefined
  for (const entry of entries) {
    if (entry.match === 'invalid') continue
    const response = z.object({company_id: id, matches: z.array(statusSchema)}).parse(
      await client.post('/customers/removal_lookup.json', {removal_email: entry.email}),
    )
    companyId ??= response.company_id
    if (companyId !== response.company_id || response.matches.some(match => match.company_id !== companyId)) {
      throw new Error('PIMA company changed during preview; no plan was saved.')
    }
    entry.candidate_customer_ids = response.matches.flatMap(match => match.customer_id ? [match.customer_id] : [])
    if (response.matches.length > 1) entry.match = 'ambiguous'
    else if (response.matches.length === 1) {
      entry.result = response.matches[0]
      entry.customer_id = entry.result.customer_id
      entry.match = entry.customer_id ? 'matched' : 'removed_without_customer'
    }
  }
  if (!companyId) throw new Error('CSV contains no valid emails to look up.')
  return validatePlan({format: 'pima-customer-erasure-plan/v2', host: client.host, company_id: companyId, entries})
}

function validatePlan(value: unknown): ErasurePlan {
  const plan = planSchema.parse(value)
  const ids = plan.entries.filter(entry => entry.match === 'matched').map(entry => entry.customer_id)
  if (ids.includes(null) || new Set(ids).size !== ids.length || plan.entries.some(entry =>
    entry.result && (entry.result.company_id !== plan.company_id || entry.result.customer_id !== entry.customer_id))) {
    throw new Error('Invalid or duplicate customer IDs in the saved plan.')
  }
  return plan
}

export async function readErasurePlan(path: string): Promise<ErasurePlan> {
  return validatePlan(JSON.parse(await readFile(path, 'utf8')))
}

export async function writeErasureFile(path: string, contents: string): Promise<void> {
  await writeFile(path, contents, {encoding: 'utf8', flag: 'wx', mode: 0o600})
}

async function replacePlan(path: string, contents: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeErasureFile(temporary, contents)
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch(() => {})
  }
}

// Each request acts on one saved customer ID. No batch record or batch worker exists in PIMA.
export async function runErasurePlan(client: ErasureClient, path: string, options: {submit?: boolean; concurrency?: number} = {}): Promise<ErasurePlan> {
  const concurrency = options.concurrency ?? 1
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('Concurrency must be between 1 and 5.')
  const lockPath = `${path}.lock`
  const lock = await open(lockPath, 'wx', 0o600).catch(() => {
    throw new Error(`Cannot lock plan. If a previous run was interrupted, verify it has stopped before removing ${lockPath}.`)
  })
  try {
    const plan = await readErasurePlan(path)
    if (client.host.replace(/\/$/, '') !== plan.host.replace(/\/$/, '')) throw new Error('Plan belongs to a different PIMA host. Select it with --host.')
    let saved = Promise.resolve()
    const save = (): Promise<void> => {
      const contents = JSON.stringify(plan, null, 2) + '\n'
      saved = saved.then(() => replacePlan(path, contents))
      return saved
    }
    // Verify checkpoint writes work before allowing any removal request.
    await save()
    const entries = plan.entries.filter(entry => entry.match === 'matched')
    let next = 0
    let stopped = false
    const checkStatus = (entry: ErasureEntry, value: unknown): ErasureStatus => {
      const result = statusSchema.parse(value)
      if (result.customer_id !== entry.customer_id || result.company_id !== plan.company_id) throw new Error('PIMA returned a different customer or company.')
      return result
    }
    const worker = async (): Promise<void> => {
      while (!stopped && next < entries.length) {
        const entry = entries[next++]
        try {
          entry.result = checkStatus(entry, await client.get(`/customers/${entry.customer_id}/removal_status.json`))
          delete entry.error
          const requestIds = [...new Set(entry.rows.flatMap(row => row.request_id ? [row.request_id] : []))]
          const finished = entry.result.pima_status === 'removed' && ['submitted', 'not_required'].includes(entry.result.shopify_status)
          if (options.submit && (!finished || requestIds.some(requestId => !entry.result!.request_ids.includes(requestId)))) {
            const response = await client.post<{data_removal: unknown}>(`/customers/${entry.customer_id}/remove_personal_data.json`, {
              expected_email: entry.email, request_ids: requestIds,
            })
            entry.result = checkStatus(entry, response.data_removal)
          }
        } catch (error) {
          entry.error = error instanceof Error ? error.message : String(error)
        }
        try { await save() } catch (error) { stopped = true; throw error }
      }
    }
    const workers = await Promise.allSettled(Array.from({length: concurrency}, () => worker()))
    const failed = workers.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
    return plan
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

export function erasureHasFailures(plan: ErasurePlan): boolean {
  return plan.entries.some(entry => entry.error || entry.result?.shopify_status === 'failed')
}

export function erasureSummary(plan: ErasurePlan): string {
  const count = (values: string[]): string => JSON.stringify(values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {}))
  return [
    `${plan.entries.reduce((total, entry) => total + entry.rows.length, 0)} source rows; ${plan.entries.length} unique entries.`,
    `Matches: ${count(plan.entries.map(entry => entry.match))}`,
    `PIMA: ${count(plan.entries.map(entry => entry.result?.pima_status || 'skipped'))}`,
    `Shopify requests: ${count(plan.entries.map(entry => entry.result?.shopify_status || 'unknown'))}`,
    `Errors: ${plan.entries.filter(entry => entry.error).length}`,
    'Shopify submitted means the request was accepted; it does not confirm erasure completion.',
  ].join('\n')
}

export function erasureResultsCsv(plan: ErasurePlan): string {
  const columns = ['row', 'request_id', 'customer_id', 'candidate_customer_ids', 'match', 'duplicate_of_row', 'pima_status', 'shopify_status', 'shopify_requested_at', 'error']
  const escape = (value: unknown): string => {
    let text = value == null ? '' : String(value)
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
  }
  const rows = plan.entries.flatMap(entry => entry.rows.map((source, index) => [source.row, source.request_id,
    entry.customer_id, entry.candidate_customer_ids.join(';'), entry.match, index ? entry.rows[0].row : null,
    entry.result?.pima_status || 'skipped', entry.result?.shopify_status || 'unknown', entry.result?.shopify_requested_at,
    entry.error ? 'Request failed; see local plan' : entry.result?.error_class,
  ])).sort((a, b) => Number(a[0]) - Number(b[0]))
  return [columns.join(','), ...rows.map(row => row.map(escape).join(','))].join('\n') + '\n'
}
