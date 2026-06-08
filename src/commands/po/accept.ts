import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyMemberActionAccess} from '../../lib/access.js'
import {memberAction} from '../../lib/resource.js'

export default class PoAccept extends BaseCommand {
  static description = 'Accept (receive) a purchase order. Requires scope: purchasing:write.'
  static examples = ['<%= config.bin %> po accept 13529 --yes']
  static args = {id: Args.string({required: true, description: 'Purchase order id'})}
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PoAccept)
    try {
      if (flags['dry-run']) {
        await verifyMemberActionAccess({host: flags.host, resource: 'purchase_orders', action: 'accept', method: 'GET'})
        this.log(`DRY RUN → GET /purchase_orders/${args.id}/accept`)
        return
      }
      if (!flags.yes) {
        this.log(`About to accept (receive) purchase order ${args.id}. Re-run with --yes to confirm.`)
        return
      }

      const client = await this.client(flags.host)
      await memberAction(client, 'GET', 'purchase_orders', args.id, 'accept')
      this.log(`✓ Purchase order ${args.id} accepted — receiving.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
