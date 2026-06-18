import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {calendarResolve, flatCalendarPeriod, normalizeCalendarParams, parseCalendarPeriod} from '../src/lib/calendar.js'

describe('calendar helpers', () => {
  it('parses NRF week phrases into structured params', () => {
    assert.deepEqual(parseCalendarPeriod('nrf week 48 in FY2025'), {
      calendar: 'nrf',
      fy: 2025,
      nrf_week: 48,
    })
  })

  it('normalizes parsed periods without overwriting them with absent flags', () => {
    assert.deepEqual(
      normalizeCalendarParams({
        period: 'NRF W48 FY25',
        nrf_week: undefined,
        nrf_month: undefined,
      }),
      {
        calendar: 'nrf',
        fy: 2025,
        nrf_week: 48,
      },
    )
  })

  it('fetches calendar resolve with encoded params', async () => {
    const calls: string[] = []
    const client = {
      get: async (path: string) => {
        calls.push(path)
        return {
          calendar: 'nrf',
          label: 'FY2025 NRF week 48',
          grain: 'week',
          range: {from: '2025-12-28', to: '2026-01-03'},
          merch: {fy: 2025, year: 2025, week: 48, month: 12, quarter: 4, weeks_in_year: 52, is_53_week_year: false},
        }
      },
    } as any

    await calendarResolve(client, {period: 'nrf week 48 in FY2025'})

    const [path, query] = calls[0].split('?')
    const qs = new URLSearchParams(query)

    assert.equal(path, '/api_calendar/resolve.json')
    assert.equal(qs.get('calendar'), 'nrf')
    assert.equal(qs.get('fy'), '2025')
    assert.equal(qs.get('nrf_week'), '48')
    assert.equal(qs.has('period'), false)
  })

  it('flattens calendar periods for human output', () => {
    const flat = flatCalendarPeriod({
      calendar: 'nrf',
      label: 'FY2025 NRF week 48',
      grain: 'week',
      range: {from: '2025-12-28', to: '2026-01-03'},
      merch: {fy: 2025, year: 2025, week: 48, month: 12, quarter: 4, weeks_in_year: 52, is_53_week_year: false},
      comparison: {previous_year: {from: '2024-12-29', to: '2025-01-04'}},
    })

    assert.equal(flat.label, 'FY2025 NRF week 48')
    assert.equal(flat.range, '2025-12-28..2026-01-03')
    assert.equal(flat.previous_year, '2024-12-29..2025-01-04')
  })
})
