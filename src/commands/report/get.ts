import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {assertSupportedReportPayload} from '../../lib/reports.js'

// Fetch a legacy report payload as JSON. For sales metrics, use `metrics sales`;
// most report endpoints return UI/build metadata rather than computed rows.
export default class ReportGet extends BaseCommand {
  static description =
    'Fetch a legacy report payload as JSON. For sales answers, prefer `pima metrics sales`. Requires scope: reports:read.'

  static examples = [
    '<%= config.bin %> report get inventory_on_hand_report --json',
    '<%= config.bin %> metrics sales --today --channel pos --json',
  ]

  static args = {name: Args.string({required: true, description: 'Report id, e.g. inventory_on_hand_report'})}
  static flags = {
    param: Flags.string({multiple: true, description: 'Extra query param key=value (repeatable)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ReportGet)

    try {
      assertSupportedReportPayload(args.name)

      const qs = new URLSearchParams()
      for (const pair of flags.param ?? []) {
        const idx = pair.indexOf('=')
        if (idx > 0) qs.set(pair.slice(0, idx), pair.slice(idx + 1))
      }

      const client = await this.client(flags.host)
      const data = await client.get(`/reports/${args.name}.json?${qs.toString()}`)
      this.log(JSON.stringify(data, null, 2))
    } catch (error) {
      this.fail(error)
    }
  }
}
