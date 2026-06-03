import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {listResource} from '../../lib/resource.js'

// Generic escape hatch: list any PIMA catalog resource by name.
export default class ResourceList extends BaseCommand {
  static description = 'List any PIMA resource by name (generic). Scope depends on the resource domain.'
  static examples = [
    '<%= config.bin %> resource list coupons',
    '<%= config.bin %> resource list units --q AVAILABLE --page 2 --json',
  ]

  static args = {resource: Args.string({required: true, description: 'Resource name, e.g. coupons, units, vendors'})}
  static flags = {
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
    variant: Flags.string({description: 'View variant, if the resource supports one'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceList)
    try {
      const client = await this.client(flags.host)
      const {records, columns} = await listResource(client, args.resource, {
        q: flags.q,
        page: flags.page,
        variant: flags.variant,
      })
      this.printList(records, columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
