import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class PoShow extends BaseCommand {
  static description = 'Show a purchase order. Requires scope: purchasing:read.'
  static args = {id: Args.string({required: true, description: 'Purchase order id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(PoShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'purchase_orders', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
