import type {Manifest, ManifestResource, ManifestField, ManifestAction, ManifestAccess, ManifestFilter} from './manifest.js'
import {resourceAppUrl} from './links.js'

// Human-readable renderers for the manifest, shared by `resource describe` and
// the live `skill resources` briefing so the two never drift.

function scopeLine(r: ManifestResource): string {
  if (!r.scopes) return 'scopes: (public / none)'
  const parts: string[] = []
  if (r.scopes.read) parts.push(`read=${r.scopes.read}`)
  if (r.scopes.write) parts.push(`write=${r.scopes.write}`)
  return `scopes: ${parts.length ? parts.join(' ') : '(none)'}`
}

// "✓"/"✗" per verb — the access the CURRENT caller has (ability ∩ token scopes).
function accessLine(a: ManifestAccess | undefined): string {
  if (!a) return 'access: (not reported)'
  const mark = (v?: boolean) => (v ? '✓' : '✗')
  return `access: read ${mark(a.read)}  create ${mark(a.create)}  update ${mark(a.update)}  destroy ${mark(a.destroy)}`
}

// Compact one-token access indicator for tables/briefings, e.g. `r-cud` where a
// granted verb shows its letter and a denied verb shows `-`.
export function accessCell(a: ManifestAccess | undefined): string {
  if (!a) return '?'
  const flag = (v: boolean | undefined, ch: string) => (v ? ch : '-')
  return `${flag(a.read, 'r')}${flag(a.create, 'c')}${flag(a.update, 'u')}${flag(a.destroy, 'd')}`
}

function fieldLine(f: ManifestField): string {
  const tags: string[] = [f.type]
  if (f.required) tags.push('required')
  if (f.read_only) tags.push('read-only')
  if (f.multiple) tags.push('multiple')
  if (f.options_resource) tags.push(`→ ${f.options_resource}`)
  else if (f.choices?.length) tags.push(`choices: ${f.choices.map((c) => c.value).join('|')}`)
  return `  ${f.key} (${tags.join(', ')})`
}

function filterLine(f: ManifestFilter): string {
  const detail: string[] = [f.type]
  if (f.options_resource) detail.push(`→ ${f.options_resource}`)
  else if (f.choices?.length) detail.push(`choices: ${f.choices.map((c) => c.value).join('|')}`)
  if (f.views?.length) detail.push(`views: ${f.views.join('|')}`)
  if (f.exclude_views?.length) detail.push(`except: ${f.exclude_views.join('|')}`)
  return `  ${f.key} (${detail.join(', ')})`
}

function filterBrief(f: ManifestFilter): string {
  const suffix: string[] = []
  if (f.options_resource) suffix.push(`→${f.options_resource}`)
  if (f.views?.length) suffix.push(`@${f.views.join('|')}`)
  if (f.exclude_views?.length) suffix.push(`!${f.exclude_views.join('|')}`)
  return `${f.key}${suffix.join('')}`
}

function actionLine(a: ManifestAction): string {
  const mut = a.mutating === undefined ? '' : a.mutating ? ' [mutating]' : ' [read-only]'
  return `  ${a.name} [${a.method}] ${a.path}${mut}`
}

// Full human-readable detail for one resource (the `resource describe` body).
// `gated` reflects the manifest-level flag: when true the surface (and the
// resource's `access` block) is filtered to the caller's ability ∩ token scopes.
export function renderResourceDetail(r: ManifestResource, gated?: boolean, host?: string): string {
  const out: string[] = []
  out.push(`${r.id}${r.title ? ` — ${r.title}` : ''}`)
  if (gated !== undefined) out.push(`manifest: ${gated ? 'gated (filtered to your access)' : 'ungated (full surface)'}`)
  if (r.model) out.push(`model: ${r.model}${r.singular ? `  singular: ${r.singular}` : ''}`)
  out.push(`domain: ${r.domain ?? '(none)'}`)
  out.push(scopeLine(r))
  out.push(accessLine(r.access))

  const supports = Object.entries(r.supports ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k)
  out.push(`supports: ${supports.length ? supports.join(', ') : '(none)'}`)

  // Search
  const searchFields = r.search?.fields ?? []
  out.push('')
  out.push('SEARCH:')
  out.push(
    searchFields.length
      ? `  fields: ${searchFields.join(', ')}${r.search?.placeholder ? `  (“${r.search.placeholder}”)` : ''}`
      : '  (none)',
  )

  // Filters
  out.push('')
  out.push('FILTERS:')
  if (r.filters?.length) {
    for (const f of r.filters) {
      out.push(filterLine(f))
    }
  } else {
    out.push('  (none)')
  }

  if (r.query_contract?.params?.length) {
    out.push('')
    out.push('QUERY PARAMS:')
    out.push(`  ${r.query_contract.params.map((param) => param.key).join(', ')}`)
  }

  // Create / update fields
  const writable = (r.fields ?? []).filter((f) => !f.read_only)
  out.push('')
  out.push('CREATE/UPDATE FIELDS:')
  if (writable.length) {
    for (const f of writable) out.push(fieldLine(f))
  } else {
    out.push('  (none)')
  }

  const readOnly = (r.fields ?? []).filter((f) => f.read_only)
  if (readOnly.length) {
    out.push('')
    out.push('READ-ONLY FIELDS:')
    for (const f of readOnly) out.push(fieldLine(f))
  }

  // Actions
  out.push('')
  out.push('MEMBER ACTIONS:')
  if (r.member_actions?.length) {
    for (const a of r.member_actions) out.push(actionLine(a))
  } else {
    out.push('  (none)')
  }

  out.push('')
  out.push('COLLECTION ACTIONS:')
  if (r.collection_actions?.length) {
    for (const a of r.collection_actions) out.push(actionLine(a))
  } else {
    out.push('  (none)')
  }

  // Paths
  out.push('')
  out.push('PATHS:')
  for (const [k, v] of Object.entries(r.paths ?? {})) {
    if (v) out.push(`  ${k}: ${v}`)
  }

  if (host) {
    out.push('')
    out.push('APP LINKS:')
    const add = (label: string, fn: () => string) => {
      try {
        out.push(`  ${label}: ${fn()}`)
      } catch {
        // Unsupported path for this resource; omit it from human output.
      }
    }

    add('index', () => resourceAppUrl(host, r))
    add('new', () => resourceAppUrl(host, r, {action: 'new'}))
    if (r.paths?.show) out.push(`  show: ${resourceAppUrl(host, r, {id: '{id}'})}`)
    if (r.paths?.edit || r.paths?.show) out.push(`  edit: ${resourceAppUrl(host, r, {action: 'edit', id: '{id}'})}`)
    for (const view of r.views ?? []) {
      add(`view ${view.id}`, () => resourceAppUrl(host, r, {variant: view.id}))
    }
  }

  return out.join('\n')
}

// Live agent briefing: every resource grouped by domain, with its search /
// filter params, key create fields, and member actions. Markdown.
export function renderResourcesBriefing(manifest: Manifest): string {
  const resources = [...(manifest.resources ?? [])].sort((a, b) =>
    (a.domain ?? '').localeCompare(b.domain ?? '') || a.id.localeCompare(b.id),
  )

  const byDomain = new Map<string, ManifestResource[]>()
  for (const r of resources) {
    const d = r.domain ?? '(no domain)'
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d)!.push(r)
  }

  const out: string[] = []
  out.push('# PIMA resource surface (live from /api_manifest.json)')
  out.push('')
  out.push(
    `Manifest v${manifest.version} — ${resources.length} resource(s) across ${byDomain.size} domain(s). ` +
      (manifest.gated
        ? 'GATED: this surface is filtered to your access (ability ∩ token scopes); inaccessible resources are absent and each `access` reflects what you can do. '
        : 'Ungated: this is the full surface. ') +
      'Use `pima resource describe <name>` for full detail, or the `pima_describe` MCP tool.',
  )

  for (const [domain, list] of byDomain) {
    out.push('')
    out.push(`## ${domain}`)
    for (const r of list) {
      const scopes = r.scopes
        ? [r.scopes.read && `r:${r.scopes.read}`, r.scopes.write && `w:${r.scopes.write}`].filter(Boolean).join(' ')
        : 'public'
      out.push('')
      out.push(`### ${r.id}${r.title ? ` — ${r.title}` : ''}  (${scopes})`)
      if (r.access) out.push(`- access: ${accessCell(r.access)} (r/c/u/d)`)

      const search = r.search?.fields ?? []
      if (search.length) out.push(`- search: ${search.join(', ')}`)

      if (r.filters?.length) {
        out.push(
          `- filters: ${r.filters
            .map((f) => filterBrief(f))
            .join(', ')}`,
        )
      }

      const create = (r.fields ?? []).filter((f) => !f.read_only)
      if (create.length) {
        out.push(
          `- create fields: ${create
            .map((f) => `${f.key}${f.required ? '*' : ''}`)
            .join(', ')}`,
        )
      }

      if (r.member_actions?.length) {
        out.push(
          `- actions: ${r.member_actions
            .map((a) => `${a.name}${a.mutating ? '!' : ''}`)
            .join(', ')}`,
        )
      }
    }
  }

  return out.join('\n')
}
