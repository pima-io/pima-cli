import {createHash} from 'node:crypto'
import {Client} from './client.js'
import {readToken} from './auth.js'
import {resolveHost} from './config.js'
import {getEntry, setEntry, deleteEntriesByPrefix} from './store.js'

// The API manifest is the server's self-description of its full resource
// surface (GET /api_manifest.json). We cache it to the file store so agents and
// commands can introspect without a round-trip every time.

export interface ManifestChoice {
  value: string
  label: string
}

export interface ManifestFilter {
  key: string
  label: string
  type: string
  choices?: ManifestChoice[]
  options_resource?: string | null
  option_params?: Record<string, unknown> | null
  views?: string[]
  exclude_views?: string[]
}

export interface ManifestColumn {
  key: string
  label: string
  type?: string
  sortable?: boolean
}

export interface ManifestField {
  key: string
  label: string
  type: string
  required?: boolean
  read_only?: boolean
  options_resource?: string | null
  choices?: ManifestChoice[]
  section?: string | null
  multiple?: boolean
}

export interface ManifestView {
  id: string
  title: string
}

export interface ManifestAction {
  name: string
  method: string // "|"-delimited verb set, e.g. "GET|POST|PATCH"
  path: string // uses {id} placeholder
  mutating?: boolean // whether the action changes state (vs. a read-only action)
}

// Per-resource access, as resolved by the server for the CURRENT caller
// (ability ∩ token scopes). Inaccessible resources are absent from the manifest
// entirely; this block tells you which of the four verbs the caller may perform.
export interface ManifestAccess {
  read?: boolean
  create?: boolean
  update?: boolean
  destroy?: boolean
}

export interface ManifestScopes {
  read?: string
  write?: string
}

export interface ManifestResource {
  id: string
  model?: string
  title?: string
  singular?: string
  domain?: string
  scopes: ManifestScopes | null
  access?: ManifestAccess
  supports?: {index?: boolean; show?: boolean; create?: boolean; update?: boolean; destroy?: boolean}
  paths?: {index?: string; show?: string; new?: string; create?: string; update?: string; destroy?: string}
  search?: {fields: string[]; placeholder: string | null} | null
  filters?: ManifestFilter[]
  columns?: ManifestColumn[]
  fields?: ManifestField[]
  views?: ManifestView[]
  member_actions?: ManifestAction[]
  collection_actions?: ManifestAction[]
}

export interface Manifest {
  version: string
  gated?: boolean // true when the surface is filtered by the caller's ability ∩ token scopes
  resources: ManifestResource[]
}

interface CacheEntry {
  fetched_at: number // epoch ms
  manifest: Manifest
}

const TTL_MS = 24 * 60 * 60 * 1000 // 24h

// The cache key is prefixed by host (so we can purge a host on login/logout)
// AND fingerprinted by the access token. The manifest is now GATED by the
// caller's ability ∩ token scopes, so a different token (e.g. a re-login with
// different scopes) yields a different manifest — fingerprinting the token
// naturally misses the stale entry instead of serving the wrong surface.
export const manifestKeyPrefix = (host: string) => `manifest:${host}:`

function tokenFingerprint(accessToken: string | undefined): string {
  if (!accessToken) return 'anon'
  return createHash('sha256').update(accessToken).digest('hex').slice(0, 8)
}

const cacheKey = (host: string, fp: string) => `${manifestKeyPrefix(host)}${fp}`

export interface FetchManifestOptions {
  host?: string
  refresh?: boolean
}

// Fetch the manifest, serving from the file-store cache when fresh. `refresh`
// bypasses the cache and re-writes it. The Client already sends the bearer
// token + lean header.
export async function fetchManifest(opts: FetchManifestOptions = {}): Promise<Manifest> {
  const host = await resolveHost(opts.host)
  const token = await readToken(host)
  const key = cacheKey(host, tokenFingerprint(token?.access_token))

  if (!opts.refresh) {
    const cached = await getEntry<CacheEntry>(key)
    if (cached && Date.now() - cached.fetched_at < TTL_MS) return cached.manifest
  }

  const client = await Client.create({host: opts.host})
  const manifest = await client.get<Manifest>('/api_manifest.json')
  await setEntry(key, {fetched_at: Date.now(), manifest} satisfies CacheEntry)
  return manifest
}

// Drop every cached manifest entry for a host (all token fingerprints). Called
// after login/logout so a new token never reads a manifest fetched under the
// old one.
export async function clearManifestCache(host: string): Promise<void> {
  await deleteEntriesByPrefix(manifestKeyPrefix(host))
}

// Resolve a resource by id, tolerating singular/plural forms.
export function findResource(manifest: Manifest, name: string): ManifestResource | undefined {
  const needle = name.trim().toLowerCase()
  const resources = manifest.resources ?? []

  const exact = resources.find((r) => r.id?.toLowerCase() === needle)
  if (exact) return exact

  const bySingular = resources.find((r) => r.singular?.toLowerCase() === needle)
  if (bySingular) return bySingular

  // Tolerate plural/singular drift: compare with trailing 's' normalized off.
  const trimmed = (s: string) => s.replace(/s$/i, '')
  const n = trimmed(needle)
  return resources.find((r) => trimmed(r.id ?? '') === n || trimmed(r.singular ?? '') === n)
}
