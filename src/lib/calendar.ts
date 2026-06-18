import {Client} from './client.js'

export interface CalendarPeriodParams {
  calendar?: 'nrf' | 'retail' | 'merch' | 'fiscal' | string
  fy?: string | number
  fiscal_year?: string | number
  nrf_week?: string | number
  retail_week?: string | number
  fiscal_week?: string | number
  merch_week?: string | number
  nrf_month?: string | number
  retail_month?: string | number
  fiscal_month?: string | number
  merch_month?: string | number
  nrf_quarter?: string | number
  retail_quarter?: string | number
  fiscal_quarter?: string | number
  merch_quarter?: string | number
  period?: string
}

export interface CalendarPeriod {
  calendar: string
  aliases?: string[]
  label: string
  grain: 'week' | 'month' | 'quarter' | 'year' | string
  range: {from: string; to: string}
  merch: {
    fy: number
    year: number
    week: number
    month: number
    julian_month?: number
    week_of_month?: number
    quarter: number
    weeks_in_year: number
    is_53_week_year: boolean
  }
  comparison?: Record<string, {from: string; to: string}>
}

export async function calendarResolve(client: Client, params: CalendarPeriodParams = {}): Promise<CalendarPeriod> {
  return client.get(`/api_calendar/resolve.json?${queryString(normalizeCalendarParams(params))}`)
}

export function normalizeCalendarParams<T extends CalendarPeriodParams>(params: T): Omit<T, 'period'> & CalendarPeriodParams {
  const {period, ...rest} = params
  const parsed = parseCalendarPeriod(period)
  const normalized: Record<string, unknown> = {...parsed}

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) normalized[key] = value
  }

  if (hasCalendarSelector(normalized) && !normalized.calendar) normalized.calendar = 'nrf'
  delete normalized.period

  return normalized as Omit<T, 'period'> & CalendarPeriodParams
}

export function parseCalendarPeriod(period?: string): CalendarPeriodParams {
  const text = period?.trim()
  if (!text) return {}

  const fyMatch =
    text.match(/\bfy\s*'?(\d{2,4})\b/i) ??
    text.match(/\bfiscal\s+year\s*'?(\d{2,4})\b/i) ??
    text.match(/\bretail\s+year\s*'?(\d{2,4})\b/i)
  const weekMatch = text.match(/\b(?:nrf|retail|fiscal|merch)?\s*(?:week|wk|w)\s*#?\s*(\d{1,2})\b/i)
  const monthMatch = text.match(/\b(?:nrf|retail|fiscal|merch)?\s*(?:month|mo|m)\s*#?\s*(\d{1,2})\b/i)
  const quarterMatch = text.match(/\b(?:nrf|retail|fiscal|merch)?\s*(?:quarter|qtr|q)\s*#?\s*(\d{1})\b/i)

  if (!fyMatch) {
    throw new Error('Could not parse NRF period. Include a fiscal year like FY2025.')
  }

  const parsed: CalendarPeriodParams = {calendar: 'nrf', fy: normalizeYear(fyMatch[1])}
  if (weekMatch) parsed.nrf_week = Number(weekMatch[1])
  else if (monthMatch) parsed.nrf_month = Number(monthMatch[1])
  else if (quarterMatch) parsed.nrf_quarter = Number(quarterMatch[1])

  return parsed
}

export function flatCalendarPeriod(period: CalendarPeriod): Record<string, string | number | boolean> {
  return {
    label: period.label,
    calendar: period.calendar,
    grain: period.grain,
    range: period.range.from === period.range.to ? period.range.from : `${period.range.from}..${period.range.to}`,
    fy: period.merch.fy,
    nrf_week: period.merch.week,
    nrf_month: period.merch.month,
    nrf_quarter: period.merch.quarter,
    weeks_in_year: period.merch.weeks_in_year,
    is_53_week_year: period.merch.is_53_week_year,
    previous_year: formatComparison(period.comparison?.previous_year),
    previous_week: formatComparison(period.comparison?.previous_week),
  }
}

function normalizeYear(value: string): number {
  const year = Number(value)
  return year < 100 ? 2000 + year : year
}

function hasCalendarSelector(params: Record<string, unknown>): boolean {
  return Boolean(
    params.fy ??
      params.fiscal_year ??
      params.nrf_week ??
      params.retail_week ??
      params.fiscal_week ??
      params.merch_week ??
      params.nrf_month ??
      params.retail_month ??
      params.fiscal_month ??
      params.merch_month ??
      params.nrf_quarter ??
      params.retail_quarter ??
      params.fiscal_quarter ??
      params.merch_quarter,
  )
}

function formatComparison(range?: {from: string; to: string}): string {
  if (!range) return ''
  return range.from === range.to ? range.from : `${range.from}..${range.to}`
}

function queryString(params: object): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params) as Array<[string, unknown]>) {
    if (value == null || value === '' || value === false) continue
    qs.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }

  return qs.toString()
}
