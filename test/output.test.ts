import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
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
    assert.deepEqual(JSON.parse(renderList(rows, columns, 'json')), rows)
  })

  it('renders a CSV header + escaped values', () => {
    const csv = renderList(rows, columns, 'csv')
    assert.equal(csv.split('\n')[0], 'ID,Name')
    assert.ok(csv.includes('"Beta, Inc."')) // comma forces quoting
  })

  it('renders a human table with headers and values', () => {
    const table = renderList(rows, columns, 'table')
    assert.ok(table.includes('ID'))
    assert.ok(table.includes('Alpha'))
  })

  it('flattens nested {label} cells', () => {
    const out = renderList([{id: 1, name: {label: 'Nested'}}], columns, 'csv')
    assert.ok(out.includes('Nested'))
  })
})

describe('renderRecord', () => {
  it('passes JSON through', () => {
    assert.deepEqual(JSON.parse(renderRecord({a: 1}, 'json')), {a: 1})
  })
})
