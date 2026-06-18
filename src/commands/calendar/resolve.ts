import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {calendarResolve, flatCalendarPeriod, normalizeCalendarParams, type CalendarPeriodParams} from '../../lib/calendar.js'

export default class CalendarResolve extends BaseCommand {
  static description = 'Resolve NRF / retail calendar periods to exact Gregorian date ranges. Requires an active PIMA login.'
  static examples = [
    '<%= config.bin %> calendar resolve --fy 2025 --nrf-week 48',
    '<%= config.bin %> calendar resolve --period "nrf week 48 in FY2025" --json',
    '<%= config.bin %> calendar resolve --fy 2025 --nrf-month 12',
    '<%= config.bin %> calendar resolve --fy 2025 --nrf-quarter 4',
  ]

  static flags = {
    calendar: Flags.string({options: ['nrf', 'retail', 'merch', 'fiscal'], description: 'Calendar system. Defaults to nrf when FY/week/month/quarter is present.'}),
    fy: Flags.integer({description: 'NRF / retail fiscal year, e.g. 2025'}),
    'fiscal-year': Flags.integer({description: 'Alias for --fy'}),
    'nrf-week': Flags.integer({description: 'NRF week number within the fiscal year'}),
    'nrf-month': Flags.integer({description: 'NRF month number, 1-12'}),
    'nrf-quarter': Flags.integer({description: 'NRF quarter number, 1-4'}),
    period: Flags.string({description: 'Phrase to parse, e.g. "nrf week 48 in FY2025"'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CalendarResolve)

    try {
      const period = await calendarResolve(await this.client(flags.host), paramsFromFlags(flags))
      if (flags.json) {
        this.log(JSON.stringify(period, null, 2))
        return
      }

      this.printRecord(flatCalendarPeriod(period), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}

function paramsFromFlags(flags: Record<string, any>): CalendarPeriodParams {
  return normalizeCalendarParams({
    calendar: flags.calendar,
    fy: flags.fy ?? flags['fiscal-year'],
    nrf_week: flags['nrf-week'],
    nrf_month: flags['nrf-month'],
    nrf_quarter: flags['nrf-quarter'],
    period: flags.period,
  })
}
