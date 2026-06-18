import type {
  Manifest,
  ManifestResource,
  ManifestField,
  ManifestAction,
  ManifestAccess,
  ManifestFilter,
  ManifestQueryParam,
  ManifestPathParam,
} from './manifest.js'
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
  if (f.allow_clear) tags.push('clearable')
  if (f.options_resource) tags.push(`→ ${f.options_resource}`)
  else if (f.choices?.length) tags.push(`choices: ${f.choices.map((c) => c.value).join('|')}`)
  const desc = f.description || f.agent_docs?.input_hint || f.agent_docs?.summary
  const examples = examplesText(f.examples)
  return `  ${f.key} (${tags.join(', ')})${desc ? ` — ${desc}` : ''}${examples}`
}

function filterLine(f: ManifestFilter): string {
  const detail: string[] = [f.type]
  if (f.options_resource) detail.push(`→ ${f.options_resource}`)
  else if (f.choices?.length) detail.push(`choices: ${f.choices.map((c) => c.value).join('|')}`)
  if (f.views?.length) detail.push(`views: ${f.views.join('|')}`)
  if (f.exclude_views?.length) detail.push(`except: ${f.exclude_views.join('|')}`)
  const param = f.param_key ? ` as ${f.param_key}` : ''
  return `  ${f.key}${param} (${detail.join(', ')})${f.description ? ` — ${f.description}` : ''}${examplesText(f.examples)}`
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
  const docs = a.agent_docs
  const flags: string[] = []
  if (docs?.requires_confirmation) flags.push('confirmation')
  if (docs?.dry_run_supported) flags.push('dry-run')
  const suffix = flags.length ? ` (${flags.join(', ')})` : ''
  return `  ${a.name} [${a.method}] ${a.path}${mut}${suffix}${docs?.summary ? ` — ${docs.summary}` : ''}`
}

function examplesText(examples: unknown[] | undefined): string {
  if (!examples?.length) return ''
  return `  examples: ${examples.map((value) => String(value)).join('|')}`
}

function queryParamLine(param: ManifestQueryParam): string {
  const parts: string[] = [param.type]
  if (param.choices?.length) parts.push(`choices: ${param.choices.map((choice) => String(choice)).join('|')}`)
  if (param.default !== undefined && param.default !== null) parts.push(`default: ${String(param.default)}`)
  return `  ${param.key} (${parts.join(', ')})${param.description ? ` — ${param.description}` : ''}${examplesText(param.examples)}`
}

function pathParamLine(param: ManifestPathParam): string {
  const tags: string[] = []
  if (param.required) tags.push('required')
  if (param.owner) tags.push('owner')
  if (param.resource) tags.push(`→ ${param.resource}`)
  return `  ${param.key}${param.placeholder ? ` (${param.placeholder})` : ''}${tags.length ? ` [${tags.join(', ')}]` : ''}${param.description ? ` — ${param.description}` : ''}`
}

function capabilitiesLine(r: ManifestResource): string | undefined {
  const entries = Object.entries(r.capabilities ?? {}).filter(([, value]) => value === true)
  if (!entries.length) return undefined
  return `capabilities: ${entries.map(([key]) => key).join(', ')}`
}

function compactList(values: Array<string | undefined>, max = 12): string | undefined {
  const clean = values.filter((value): value is string => Boolean(value))
  if (!clean.length) return undefined
  const shown = clean.slice(0, max)
  const suffix = clean.length > max ? `,+${clean.length - max}` : ''
  return `${shown.join('|')}${suffix}`
}

function controllerParameterKeys(r: ManifestResource): string[] {
  const contract = r.controller_contract
  if (!contract?.parameters) return contract?.documented_params ?? []

  return [
    ...(contract.parameters.query ?? []).map((param) => param.key),
    ...(contract.parameters.filters ?? []).map((param) => param.param_key ?? param.key),
    ...(contract.parameters.owner ?? []).map((param) => param.key),
  ]
}

function controllerActionNames(r: ManifestResource): string[] {
  const contract = r.controller_contract
  if (!contract?.non_crud_actions) return contract?.documented_actions ?? []

  return [
    ...(contract.non_crud_actions.member ?? []).map((action) => action.name),
    ...(contract.non_crud_actions.collection ?? []).map((action) => action.name),
  ]
}

function renderAgentGuidance(r: ManifestResource): string[] {
  const docs = r.agent_docs
  if (!docs) return []

  const out: string[] = ['', 'AGENT GUIDANCE:']
  if (docs.summary) out.push(`  ${docs.summary}`)
  const terms = docs.business_terms ?? docs.synonyms
  if (terms?.length) out.push(`  terms: ${terms.join(', ')}`)
  if (docs.when_to_use?.length) {
    out.push('  when to use:')
    for (const line of docs.when_to_use) out.push(`    - ${line}`)
  }
  if (docs.avoid_when?.length) {
    out.push('  avoid when:')
    for (const line of docs.avoid_when) out.push(`    - ${line}`)
  }
  if (docs.examples?.length) {
    out.push('  examples:')
    for (const example of docs.examples.slice(0, 6)) {
      const label = example.description ? `${example.description}: ` : ''
      out.push(`    - ${label}${example.cli ?? JSON.stringify(example)}`)
    }
  }
  return out
}

// Full human-readable detail for one resource (the `resource describe` body).
// `gated` reflects the manifest-level flag: when true the surface (and the
// resource's `access` block) is filtered to the caller's ability ∩ token scopes.
export function renderResourceDetail(r: ManifestResource, gated?: boolean, host?: string): string {
  const out: string[] = []
  out.push(`${r.id}${r.title ? ` — ${r.title}` : ''}`)
  if (gated !== undefined) out.push(`manifest: ${gated ? 'gated (filtered to your access)' : 'ungated (full surface)'}`)
  if (r.model) out.push(`model: ${r.model}${r.singular ? `  singular: ${r.singular}` : ''}`)
  if (r.model_contract) {
    const contract = [
      r.model_contract.table_name && `table=${r.model_contract.table_name}`,
      r.model_contract.primary_key && `pk=${r.model_contract.primary_key}`,
      r.model_contract.timestamp_columns?.length && `timestamps=${r.model_contract.timestamp_columns.join('|')}`,
    ].filter(Boolean)
    if (contract.length) out.push(`model contract: ${contract.join(' ')}`)
    if (r.model_contract.agent_docs?.summary) out.push(`model docs: ${r.model_contract.agent_docs.summary}`)
  }
  if (r.controller_contract) {
    const params = compactList(controllerParameterKeys(r))
    const actions = compactList(controllerActionNames(r))
    const contract = [
      r.controller_contract.path && `path=${r.controller_contract.path}`,
      r.controller_contract.declared_resource_docs && 'resource-docs',
      params && `params=${params}`,
      actions && `actions=${actions}`,
    ].filter(Boolean)
    out.push(`controller: ${r.controller_contract.name ?? '(unknown)'}${contract.length ? `  ${contract.join(' ')}` : ''}`)
  }
  out.push(`domain: ${r.domain ?? '(none)'}`)
  out.push(scopeLine(r))
  out.push(accessLine(r.access))
  const caps = capabilitiesLine(r)
  if (caps) out.push(caps)

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
    for (const param of r.query_contract.params) out.push(queryParamLine(param))
  }

  if (r.owner_params?.length) {
    out.push('')
    out.push('OWNER PATH PARAMS:')
    for (const param of r.owner_params) out.push(pathParamLine(param))
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
    for (const a of r.member_actions) {
      out.push(actionLine(a))
      if (a.agent_docs?.side_effects?.length) out.push(`    side effects: ${a.agent_docs.side_effects.join(' ')}`)
      if (a.agent_docs?.failure_modes?.length) out.push(`    failures: ${a.agent_docs.failure_modes.join(' ')}`)
    }
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

  out.push(...renderAgentGuidance(r))

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
      if (r.agent_docs?.summary) out.push(`- docs: ${r.agent_docs.summary}`)
      const caps = capabilitiesLine(r)
      if (caps) out.push(`- ${caps}`)

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
