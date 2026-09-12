import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../../lib/base.js'
import {erasureSummary, readErasurePlan, runErasurePlan, erasureHasFailures} from '../../../lib/customer-erasure.js'

export default class ErasureSubmit extends BaseCommand {
  static description = 'Remove each customer in a saved plan, sequentially by default. Requires --yes and customers:write.'
  static examples = ['<%= config.bin %> customer erasure submit preview.json --yes']
  static args = {preview: Args.string({required: true, description: 'JSON file saved by customer erasure preview'})}
  static flags = {
    yes: Flags.boolean({char: 'y', description: 'Confirm removal of the saved customer IDs'}),
    concurrency: Flags.integer({default: 1, min: 1, max: 5, description: 'Number of simultaneous customer calls (1-5)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ErasureSubmit)
    try {
      const preview = await readErasurePlan(args.preview)
      if (!flags.yes) {
        this.log(erasureSummary(preview) + '\nRe-run with --yes to run this saved plan.')
        return
      }
      const plan = await runErasurePlan(await this.client(flags.host), args.preview, {submit: true, concurrency: flags.concurrency})
      this.log(flags.json ? JSON.stringify(plan, null, 2) : erasureSummary(plan))
      if (erasureHasFailures(plan)) process.exitCode = 1
    } catch (error) {
      this.fail(error)
    }
  }
}
