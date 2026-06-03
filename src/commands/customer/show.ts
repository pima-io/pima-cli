import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class CustomerShow extends BaseCommand {
  static description = 'Show a customer with their detail. Requires scope: customers:read.'
  static examples = ['<%= config.bin %> customer show 90210 --json']
  static args = {id: Args.string({required: true, description: 'Customer id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(CustomerShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'customers', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
