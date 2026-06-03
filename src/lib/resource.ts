import {Client} from './client.js'
import type {Column} from './output.js'

export interface ListResult {
  records: any[]
  columns: Column[]
  pagination?: {page: number; total_pages: number; total_entries: number}
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
