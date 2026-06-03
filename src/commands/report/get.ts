import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'

// Fetch a report as JSON. Reports live at /reports/<name> (e.g. sales_report,
// performance_report, inventory_on_hand_report). Requires reports:read.
export default class ReportGet extends BaseCommand {
  static description = 'Fetch a report as JSON. Requires scope: reports:read.'
  static examples = [
    '<%= config.bin %> report get sales_report --param created_from=2026-05-01',
    '<%= config.bin %> report get inventory_on_hand_report --json',
  ]

  static args = {name: Args.string({required: true, description: 'Report id, e.g. sales_report, inventory_on_hand_report'})}
  static flags = {
    param: Flags.string({multiple: true, description: 'Extra query param key=value (repeatable)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ReportGet)
    const qs = new URLSearchParams()
    for (const pair of flags.param ?? []) {
      const idx = pair.indexOf('=')
      if (idx > 0) qs.set(pair.slice(0, idx), pair.slice(idx + 1))
    }

    try {
      const client = await this.client(flags.host)
      const data = await client.get(`/reports/${args.name}.json?${qs.toString()}`)
      this.log(JSON.stringify(data, null, 2))
    } catch (error) {
      this.fail(error)
    }
  }
}
