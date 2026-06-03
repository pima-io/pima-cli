import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {listResource} from '../../lib/resource.js'

export default class ShipmentList extends BaseCommand {
  static description = 'List shipments. Requires scope: fulfillment:read.'
  static flags = {
    status: Flags.string({description: 'View variant (e.g. status_picking, status_packing, status_ready)'}),
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ShipmentList)
    try {
      const client = await this.client(flags.host)
      const {records, columns} = await listResource(client, 'shipments', {
        variant: flags.status,
        q: flags.q,
        page: flags.page,
      })
      this.printList(records, columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
