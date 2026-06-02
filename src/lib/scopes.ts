import {resolveHost} from './config.js'

// Vendored fallback of the scope taxonomy. The SERVER is the source of truth
// (`GET /oauth/scopes`); this is only used when offline / unauthenticated.
// Keep in sync via the lint:skills check.
export const DOMAINS = [
  'orders',
  'inventory',
  'transfers',
  'fulfillment',
  'products',
  'pricing',
  'purchasing',
  'customers',
  'reports',
  'admin',
] as const

export type Domain = (typeof DOMAINS)[number]
export type Scope = `${Domain}:read` | `${Domain}:write`

export const ALL_SCOPES: Scope[] = DOMAINS.flatMap((d) => [`${d}:read`, `${d}:write`] as Scope[])
export const READ_ONLY: Scope[] = DOMAINS.map((d) => `${d}:read` as Scope)

export interface ScopeMetadata {
  domains: {key: string; read: string; write: string; resources: string[]}[]
  presets: {read_only: string[]}
}

// Live fetch of the server's scope metadata, with the vendored fallback.
export async function fetchScopeMetadata(flagHost?: string): Promise<ScopeMetadata | null> {
  try {
    const host = await resolveHost(flagHost)
    const res = await fetch(`${host}/oauth/scopes`, {headers: {Accept: 'application/json'}})
    if (res.ok) return (await res.json()) as ScopeMetadata
  } catch {
    /* fall through to null → caller uses vendored DOMAINS */
  }
  return null
}
