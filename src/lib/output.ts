import Table from 'cli-table3'

export type OutputFormat = 'table' | 'json' | 'csv'

export interface Column {
  key: string
  label: string
}

// Render a list of records in the chosen format. `columns` typically comes
// straight from the lean payload's `resource.columns` so tables stay in sync
// with the server without per-command formatting.
export function renderList(records: any[], columns: Column[], format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(records, null, 2)
  if (format === 'csv') return toCsv(records, columns)

  const table = new Table({head: columns.map((c) => c.label)})
  for (const rec of records) {
    table.push(columns.map((c) => cell(rec[c.key])))
  }
  return table.toString()
}

export function renderRecord(record: any, format: OutputFormat): string {
  if (format === 'json') return JSON.stringify(record, null, 2)
  const table = new Table()
  for (const [k, v] of Object.entries(record)) {
    if (v && typeof v === 'object') continue // skip nested for the human view
    table.push({[k]: cell(v)})
  }
  return table.toString()
}

function cell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as any
    return o.label ?? o.name ?? o.code ?? JSON.stringify(o)
  }
  return String(v)
}

function toCsv(records: any[], columns: Column[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const header = columns.map((c) => esc(c.label)).join(',')
  const rows = records.map((r) => columns.map((c) => esc(cell(r[c.key]))).join(','))
  return [header, ...rows].join('\n')
}
