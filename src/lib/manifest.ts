import {Client} from './client.js'
import {resolveHost} from './config.js'
import {getEntry, setEntry} from './store.js'

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
  resources: ManifestResource[]
}

interface CacheEntry {
  fetched_at: number // epoch ms
  manifest: Manifest
}

const TTL_MS = 24 * 60 * 60 * 1000 // 24h
const cacheKey = (host: string) => `manifest:${host}`

export interface FetchManifestOptions {
  host?: string
  refresh?: boolean
}

// Fetch the manifest, serving from the file-store cache when fresh. `refresh`
// bypasses the cache and re-writes it. The Client already sends the bearer
// token + lean header.
export async function fetchManifest(opts: FetchManifestOptions = {}): Promise<Manifest> {
  const host = await resolveHost(opts.host)
  const key = cacheKey(host)

  if (!opts.refresh) {
    const cached = await getEntry<CacheEntry>(key)
    if (cached && Date.now() - cached.fetched_at < TTL_MS) return cached.manifest
  }

  const client = await Client.create({host: opts.host})
  const manifest = await client.get<Manifest>('/api_manifest.json')
  await setEntry(key, {fetched_at: Date.now(), manifest} satisfies CacheEntry)
  return manifest
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
