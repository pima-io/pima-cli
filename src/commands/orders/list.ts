import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {listResource} from '../../lib/resource.js'

export default class OrdersList extends BaseCommand {
  static description = 'List orders. Requires scope: orders:read.'

  static examples = [
    '<%= config.bin %> orders list --status shippable',
    '<%= config.bin %> orders list --q smith --json',
  ]

  static flags = {
    status: Flags.string({description: 'View variant (e.g. shippable, unshippable, alterations)'}),
    location: Flags.integer({description: 'Filter by location id'}),
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrdersList)
    try {
      const client = await this.client(flags.host)
      const {records, columns} = await listResource(client, 'orders', {
        variant: flags.status,
        location_id: flags.location,
        q: flags.q,
        page: flags.page,
      })
      this.printList(records, columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
