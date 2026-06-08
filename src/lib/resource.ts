import {Client} from './client.js'
import type {Column} from './output.js'
import {resourceSearchParams, type ResourceFilters, type ResourceFilterValue} from './params.js'

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
  filters?: ResourceFilters
  to_email?: boolean
}

export interface ResourceListParams {
  q?: string
  page?: string | number
  per_page?: string | number
  sort?: string
  direction?: string
  variant?: string
  filters?: ResourceFilters
  [key: string]: ResourceFilterValue | ResourceFilters
}

// Generic index against any react_ui catalog resource: GET /<resource>.json.
export async function listResource(
  client: Client,
  resource: string,
  params: ResourceListParams = {},
): Promise<ListResult> {
  const qs = resourceSearchParams(params)
  const data = await client.get(`/${resource}.json?${qs.toString()}`)
  const columns: Column[] = (data.resource?.columns ?? []).map((c: any) => ({key: c.key, label: c.label}))
  return {records: data.records ?? [], columns, pagination: data.pagination}
}

function resourceParams(params: ResourceExportParams): URLSearchParams {
  return resourceSearchParams(params)
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

export interface VersionHistory {
  label: string
  item_type: string
  item_id: number | string
  supports_history: boolean
  versions: Array<{
    id: string
    event: string
    label: string
    author?: {label?: string; username?: string; full_name?: string}
    created_at?: string
    changes: Array<{label: string; from?: unknown; to?: unknown}>
  }>
  pagination?: {page: number; per_page: number; total_entries: number; total_pages: number}
}

export async function resourceHistory(
  client: Client,
  itemType: string,
  id: string | number,
  page?: string | number,
): Promise<VersionHistory> {
  const qs = new URLSearchParams({item_type: itemType, item_id: String(id)})
  if (page !== undefined && page !== '') qs.set('page', String(page))
  return client.get(`/versions.json?${qs.toString()}`)
}

export interface ResourceComments {
  comments: Array<{
    id: number
    text_md: string
    text_html?: string
    created_at?: string
    updated_at?: string
    anchor?: string
    path?: string
    react_path?: string
    author?: {username?: string; full_name?: string; label?: string}
    mentioned_users?: Array<{username?: string; full_name?: string; label?: string}>
    can_destroy?: boolean
  }>
  mentionables: Array<{type: string; name: string; avatar_url?: string | null}>
  can_create: boolean
}

export async function listResourceComments(
  client: Client,
  resource: string,
  id: string | number,
): Promise<ResourceComments> {
  const qs = new URLSearchParams({resource, record_id: String(id)})
  return client.get(`/comments.json?${qs.toString()}`)
}

export async function createResourceComment(
  client: Client,
  resource: string,
  id: string | number,
  textMd: string,
): Promise<{comment: ResourceComments['comments'][number]}> {
  const qs = new URLSearchParams({resource, record_id: String(id)})
  return client.post(`/comments.json?${qs.toString()}`, {comment: {text_md: textMd}})
}
