import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class OrdersShow extends BaseCommand {
  static description = 'Show an order. Requires scope: orders:read.'
  static examples = ['<%= config.bin %> orders show 12345 --json']
  static args = {id: Args.string({required: true, description: 'Order id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(OrdersShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'orders', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
