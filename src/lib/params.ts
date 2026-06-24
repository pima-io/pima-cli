export type ResourceFilterValue = string | number | boolean | Array<string | number> | undefined
export type ResourceFilters = Record<string, ResourceFilterValue>

export interface ResourceQueryParams {
  q?: string
  page?: string | number
  per_page?: string | number
  sort?: string
  direction?: string
  variant?: string
  legacy_path?: string
  owner_resource?: string
  owner_id?: string | number
  filters?: ResourceFilters
  to_email?: boolean
}

export function parseFilterPairs(pairs: string[]): Record<string, string | string[]> {
  const filters: Record<string, string | string[]> = {}
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx <= 0) {
      const err: any = new Error(`Invalid --filter "${pair}". Use key=value.`)
      err.exitCode = 5
      throw err
    }

    const key = normalizeFilterKey(pair.slice(0, idx))
    const value = pair.slice(idx + 1)
    const existing = filters[key]
    if (existing === undefined) {
      filters[key] = value
    } else if (Array.isArray(existing)) {
      existing.push(value)
    } else {
      filters[key] = [existing, value]
    }
  }
  return filters
}

function normalizeFilterKey(key: string): string {
  const match = key.match(/^filters\[(.+)\]$/)
  return match ? match[1] : key
}

export function resourceSearchParams(params: ResourceQueryParams = {}): URLSearchParams {
  const qs = new URLSearchParams()
  const scalar: Array<keyof ResourceQueryParams> = [
    'q',
    'page',
    'per_page',
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

  const handled = new Set<string>([...scalar, 'filters', 'to_email'])
  for (const [key, value] of Object.entries(params)) {
    if (handled.has(key)) continue
    if (value === undefined || value === '' || value === false) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === 'object' && !Array.isArray(value)) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  for (const [rawKey, value] of Object.entries(params.filters ?? {})) {
    if (value === undefined || value === '' || value === false) continue
    if (Array.isArray(value) && value.length === 0) continue
    const key = normalizeFilterKey(rawKey)
    qs.set(`filters[${key}]`, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs
}

export function pathWithQuery(path: string, params: ResourceQueryParams = {}): string {
  const [pathname, existing = ''] = path.split('?')
  const qs = new URLSearchParams(existing)
  for (const [key, value] of resourceSearchParams(params)) qs.set(key, value)
  const query = qs.toString()
  return query ? `${pathname}?${query}` : pathname
}
