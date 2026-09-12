import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../../lib/base.js'
import {erasureResultsCsv, erasureSummary, runErasurePlan, erasureHasFailures, writeErasureFile} from '../../../lib/customer-erasure.js'

export default class ErasureStatus extends BaseCommand {
  static description = 'Read live PIMA/Shopify request results for saved customer IDs; optionally export one result per source row.'
  static examples = ['<%= config.bin %> customer erasure status preview.json --out results.csv']
  static args = {preview: Args.string({required: true, description: 'JSON file saved by customer erasure preview'})}
  static flags = {out: Flags.string({description: 'New CSV results file; existing files are never overwritten'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ErasureStatus)
    try {
      const plan = await runErasurePlan(await this.client(flags.host), args.preview)
      if (flags.out) await writeErasureFile(flags.out, erasureResultsCsv(plan))
      this.log(flags.json ? JSON.stringify(plan, null, 2) : flags.csv ? erasureResultsCsv(plan) : erasureSummary(plan))
      if (erasureHasFailures(plan)) process.exitCode = 1
    } catch (error) {
      this.fail(error)
    }
  }
}
