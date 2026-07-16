import {Client} from './client.js'

export interface MetabaseReportFilter {
  pima_key: string
  metabase_parameter?: string
  metabase_parameters?: string[]
  supported?: boolean
}

export interface MetabaseBuildingBlock {
  id: string
  title: string
  kind: 'model' | 'question' | 'transform' | string
  card_id: number
  entity_id?: string
  grain?: string
  reference: string
}

export interface MetabaseReport {
  id: string
  title: string
  category: string
  pima_path: string
  classic_fallback: boolean
  availability: 'available' | 'planned' | string
  filters: MetabaseReportFilter[]
  metabase?: {
    type: 'question' | 'dashboard' | string
    id: number
    entity_id?: string
    parity_status: string
    semantic_version: number
    url: string
  } | null
  building_blocks: MetabaseBuildingBlock[]
}

interface MetabaseReportsResponse {
  reports: MetabaseReport[]
  generated_at: string
}

interface MetabaseReportResponse {
  report: MetabaseReport
  generated_at: string
}

export async function metabaseReports(client: Client): Promise<MetabaseReport[]> {
  return (await client.get<MetabaseReportsResponse>('/api_metabase/reports.json')).reports
}

export async function metabaseReport(client: Client, id: string): Promise<MetabaseReport> {
  return (await client.get<MetabaseReportResponse>(`/api_metabase/reports/${encodeURIComponent(id)}.json`)).report
}

export function filterMetabaseReports(
  reports: MetabaseReport[],
  opts: {match?: string; category?: string; available?: boolean} = {},
): MetabaseReport[] {
  const terms = opts.match?.toLowerCase().split(/\s+/).filter(Boolean) ?? []
  return reports.filter((report) => {
    if (opts.available && report.availability !== 'available') return false
    if (opts.category && report.category.toLowerCase() !== opts.category.toLowerCase()) return false
    if (terms.length === 0) return true
    const haystack = [report.id, report.title, report.category, ...report.building_blocks.map((block) => `${block.id} ${block.title}`)]
      .join(' ')
      .toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export function renderMetabaseReport(report: MetabaseReport): string {
  const out = [`${report.title} (${report.id})`, `Category: ${report.category}`, `PIMA: ${report.pima_path}`]

  if (report.metabase) {
    out.push(
      `Metabase: ${report.metabase.url}`,
      `Parity: ${report.metabase.parity_status} · semantic version ${report.metabase.semantic_version}`,
    )
  } else {
    out.push('Metabase: planned; no verified canonical equivalent is available yet.')
  }

  if (report.filters.length > 0) {
    out.push('', 'Filters:')
    for (const filter of report.filters) {
      const target = filter.metabase_parameters?.join(' + ') ?? filter.metabase_parameter ?? 'not mapped'
      out.push(`  ${filter.pima_key} -> ${target}${filter.supported === false ? ' (not yet supported)' : ''}`)
    }
  }

  if (report.building_blocks.length > 0) {
    out.push('', 'Building blocks:')
    for (const block of report.building_blocks) {
      const details = [block.kind, block.grain && `grain: ${block.grain}`].filter(Boolean).join(', ')
      out.push(`  ${block.reference}  ${block.title}${details ? ` (${details})` : ''}`)
    }
    out.push(
      '',
      'Custom SQL: reference these models/questions as CTEs and apply the report filters in the outer query.',
      'Run the canonical card when it already answers the question; use raw tables only when no declared building block fits.',
    )
  }

  return out.join('\n')
}
