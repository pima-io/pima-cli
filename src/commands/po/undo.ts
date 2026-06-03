import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {memberAction} from '../../lib/resource.js'

export default class PoUndo extends BaseCommand {
  static description = 'Undo a purchase order receipt. Requires scope: purchasing:write.'
  static examples = ['<%= config.bin %> po undo 13529 --yes']
  static args = {id: Args.string({required: true, description: 'Purchase order id'})}
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PoUndo)
    if (flags['dry-run']) {
      this.log(`DRY RUN → POST /purchase_orders/${args.id}/undo`)
      return
    }
    if (!flags.yes) {
      this.log(`About to undo receiving for purchase order ${args.id}. Re-run with --yes to confirm.`)
      return
    }

    try {
      const client = await this.client(flags.host)
      await memberAction(client, 'POST', 'purchase_orders', args.id, 'undo')
      this.log(`✓ Purchase order ${args.id} receipt undone.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
