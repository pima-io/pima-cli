import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {metabaseReport, renderMetabaseReport} from '../../lib/metabase-reports.js'

export default class MetabaseReport extends BaseCommand {
  static description = 'Describe a built-in PIMA report, its canonical Metabase equivalent, filters, and reusable building blocks.'

  static examples = [
    '<%= config.bin %> metabase report fleet_report',
    '<%= config.bin %> metabase report product_report --json',
  ]

  static args = {
    id: Args.string({description: 'PIMA report id, e.g. fleet_report', required: true}),
  }

  static flags = BaseCommand.baseFlags

  async run(): Promise<void> {
    const {args, flags} = await this.parse(MetabaseReport)
    try {
      const report = await metabaseReport(await this.client(flags.host), args.id)
      this.log(flags.json ? JSON.stringify(report, null, 2) : renderMetabaseReport(report))
    } catch (error) {
      this.fail(error)
    }
  }
}
