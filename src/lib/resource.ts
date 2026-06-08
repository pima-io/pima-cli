import {Client} from './client.js'
import type {Column} from './output.js'

export interface ListResult {
  records: any[]
  columns: Column[]
  pagination?: {page: number; total_pages: number; total_entries: number}
}

export interface ResourceExport {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | string
  progress?: number
  total_records?: number
  file_url?: string | null
  to_email?: boolean
  error_message?: string | null
  created_at?: string
  started_generating_at?: string | null
  finished_generating_at?: string | null
  generation_duration?: number | null
  generation_duration_in_words?: string | null
}

export interface ResourceExportParams {
  q?: string
  sort?: string
  direction?: string
  variant?: string
  legacy_path?: string
  owner_resource?: string
  owner_id?: string | number
  filters?: Record<string, string | number | boolean | Array<string | number> | undefined>
  to_email?: boolean
}

// Generic index against any react_ui catalog resource: GET /<resource>.json.
export async function listResource(
  client: Client,
  resource: string,
  params: Record<string, string | number | undefined> = {},
): Promise<ListResult> {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  const data = await client.get(`/${resource}.json?${qs.toString()}`)
  const columns: Column[] = (data.resource?.columns ?? []).map((c: any) => ({key: c.key, label: c.label}))
  return {records: data.records ?? [], columns, pagination: data.pagination}
}

function resourceParams(params: ResourceExportParams): URLSearchParams {
  const qs = new URLSearchParams()
  const scalar: Array<keyof ResourceExportParams> = [
    'q',
    'sort',
    'direction',
    'variant',
    'legacy_path',
    'owner_resource',
    'owner_id',
  ]

  for (const key of scalar) {
    const value = params[key]
    if (value !== undefined && value !== '') qs.set(key, String(value))
  }
  if (params.to_email) qs.set('to_email', '1')

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value === undefined || value === '' || value === false) continue
    if (Array.isArray(value) && value.length === 0) continue
    qs.set(`filters[${key}]`, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs
}

// Start an async server-side CSV export for any React resource index.
export async function startResourceExport(
  client: Client,
  resource: string,
  params: ResourceExportParams = {},
): Promise<{export: ResourceExport}> {
  const qs = resourceParams(params).toString()
  return client.post(`/react_ui/resources/${resource}/export.json${qs ? `?${qs}` : ''}`)
}

// Poll export status after startResourceExport.
export async function showResourceExport(client: Client, id: string | number): Promise<{export: ResourceExport}> {
  return client.get(`/react_ui/exports/${id}.json`)
}

// Generic show: GET /<resource>/:id.json — returns the full detail payload.
export async function showResource(client: Client, resource: string, id: string | number): Promise<any> {
  return client.get(`/${resource}/${id}.json`)
}

// Generic create: POST /<resource>.json (gated server-side by <domain>:write).
export async function createResource(client: Client, resource: string, body: unknown): Promise<any> {
  return client.request('POST', `/${resource}.json`, body)
}

// Generic update: PATCH /<resource>/:id.json (gated by <domain>:write).
export async function updateResource(client: Client, resource: string, id: string | number, body: unknown): Promise<any> {
  return client.request('PATCH', `/${resource}/${id}.json`, body)
}

// Generic destroy: DELETE /<resource>/:id.json (gated by <domain>:write).
export async function destroyResource(client: Client, resource: string, id: string | number): Promise<any> {
  return client.request('DELETE', `/${resource}/${id}.json`)
}

// Generic member action: <METHOD> /<resource>/:id/<verb>.json (e.g. accept, undo).
export async function memberAction(
  client: Client,
  method: 'GET' | 'POST' | 'PATCH',
  resource: string,
  id: string | number,
  verb: string,
  body?: unknown,
): Promise<any> {
  return client.request(method, `/${resource}/${id}/${verb}.json`, body)
}
