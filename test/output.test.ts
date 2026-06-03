import {describe, it, expect} from 'vitest'
import {renderList, renderRecord} from '../src/lib/output.js'

const columns = [
  {key: 'id', label: 'ID'},
  {key: 'name', label: 'Name'},
]
const rows = [
  {id: 1, name: 'Alpha'},
  {id: 2, name: 'Beta, Inc.'},
]

describe('renderList', () => {
  it('passes JSON through unchanged', () => {
    expect(JSON.parse(renderList(rows, columns, 'json'))).toEqual(rows)
  })

  it('renders a CSV header + escaped values', () => {
    const csv = renderList(rows, columns, 'csv')
    expect(csv.split('\n')[0]).toBe('ID,Name')
    expect(csv).toContain('"Beta, Inc."') // comma forces quoting
  })

  it('renders a human table with headers and values', () => {
    const table = renderList(rows, columns, 'table')
    expect(table).toContain('ID')
    expect(table).toContain('Alpha')
  })

  it('flattens nested {label} cells', () => {
    const out = renderList([{id: 1, name: {label: 'Nested'}}], columns, 'csv')
    expect(out).toContain('Nested')
  })
})

describe('renderRecord', () => {
  it('passes JSON through', () => {
    expect(JSON.parse(renderRecord({a: 1}, 'json'))).toEqual({a: 1})
  })
})
