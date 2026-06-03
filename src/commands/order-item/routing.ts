import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'

export default class OrderItemRouting extends BaseCommand {
  static description = 'Show the order-item routing dashboard. Requires scope: orders:read.'
  static examples = ['<%= config.bin %> order-item routing --location 7 --json']

  static flags = {
    location: Flags.integer({description: 'Filter by location id'}),
    tab: Flags.string({default: 'report', description: 'Dashboard tab (report|speed|manual|auto)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrderItemRouting)
    try {
      const client = await this.client(flags.host)
      const qs = new URLSearchParams({tab: flags.tab})
      if (flags.location) qs.set('location_id', String(flags.location))
      const data = await client.get(`/order_items/routing.json?${qs.toString()}`)
      this.log(JSON.stringify(flags.json ? data : (data.order_item_routing ?? data), null, 2))
    } catch (error) {
      this.fail(error)
    }
  }
}
