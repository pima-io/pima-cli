import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {flatSalesSummary, salesSummary} from '../../lib/metrics.js'

export default class MetricsSales extends BaseCommand {
  static description = 'Fetch optimized sales metrics. Requires scope: reports:read.'
  static examples = [
    '<%= config.bin %> metrics sales --today --channel pos',
    '<%= config.bin %> metrics sales --today --channel pos --city "Los Angeles"',
    '<%= config.bin %> metrics sales --from 2026-06-01 --to 2026-06-08 --channel pos --state CA',
  ]

  static flags = {
    today: Flags.boolean({description: 'Use today as the date'}),
    date: Flags.string({description: 'Single date, YYYY-MM-DD'}),
    from: Flags.string({description: 'Start date, YYYY-MM-DD'}),
    to: Flags.string({description: 'End date, YYYY-MM-DD'}),
    channel: Flags.string({options: ['pos', 'online', 'all'], default: 'all', description: 'Sales channel'}),
    'location-id': Flags.string({description: 'Location id'}),
    'location-ids': Flags.string({description: 'Comma-separated location ids'}),
    location: Flags.string({description: 'Location name, reporting name, or short name'}),
    'short-name': Flags.string({description: 'Location short name'}),
    'location-group': Flags.string({description: 'Location group name'}),
    city: Flags.string({description: 'Location city'}),
    state: Flags.string({description: 'Location state abbreviation'}),
    'all-pos': Flags.boolean({description: 'Restrict to all POS locations'}),
    gender: Flags.string({description: 'Optional gender filter (m, w, u)'}),
    refresh: Flags.boolean({description: 'Force recalculation of stored daily metrics'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetricsSales)
    const date = flags.today ? today() : flags.date

    try {
      const summary = await salesSummary(await this.client(flags.host), {
        date,
        from: flags.from,
        to: flags.to,
        channel: flags.channel,
        location_id: flags['location-id'],
        location_ids: flags['location-ids'],
        location: flags.location,
        short_name: flags['short-name'],
        location_group: flags['location-group'],
        city: flags.city,
        state: flags.state,
        all_pos: flags['all-pos'],
        gender: flags.gender,
        refresh: flags.refresh,
      })

      if (flags.json) {
        this.log(JSON.stringify(summary, null, 2))
      } else {
        this.printRecord(flatSalesSummary(summary), flags)
      }
    } catch (error) {
      this.fail(error)
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
