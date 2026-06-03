import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {listResource} from '../../lib/resource.js'

export default class PoList extends BaseCommand {
  static description = 'List purchase orders. Requires scope: purchasing:read.'
  static flags = {
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(PoList)
    try {
      const client = await this.client(flags.host)
      const {records, columns} = await listResource(client, 'purchase_orders', {q: flags.q, page: flags.page})
      this.printList(records, columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
