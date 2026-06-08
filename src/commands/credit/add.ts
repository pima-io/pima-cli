import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyResourceAccess} from '../../lib/access.js'
import {createResource} from '../../lib/resource.js'

// Friendly wrapper over `resource create customer_credits`. Requires customers:write.
export default class CreditAdd extends BaseCommand {
  static description = 'Issue store credit to a customer. Requires scope: customers:write.'
  static examples = ['<%= config.bin %> credit add --customer 42 --amount 25 --note "goodwill" --yes']

  static flags = {
    customer: Flags.integer({required: true, description: 'Customer id'}),
    amount: Flags.string({required: true, description: 'Credit amount in dollars'}),
    note: Flags.string({description: 'Reason / note'}),
    notify: Flags.boolean({description: 'Email the customer'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditAdd)
    const body = {
      record: {
        customer_id: flags.customer,
        starting_balance_dollars: flags.amount,
        note: flags.note,
        notify_customer: flags.notify,
      },
    }

    try {
      if (flags['dry-run']) {
        await verifyResourceAccess({host: flags.host, resource: 'customer_credits', verb: 'create'})
        this.log('DRY RUN → POST /customer_credits.json')
        this.log(JSON.stringify(body, null, 2))
        return
      }
      if (!flags.yes) {
        this.log(`About to issue $${flags.amount} store credit to customer ${flags.customer}. Re-run with --yes to confirm.`)
        return
      }

      const client = await this.client(flags.host)
      const data = await createResource(client, 'customer_credits', body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Issued $${flags.amount} store credit to customer ${flags.customer}.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
