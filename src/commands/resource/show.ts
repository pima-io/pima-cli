import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

// Generic escape hatch: show any PIMA catalog resource record by name + id.
export default class ResourceShow extends BaseCommand {
  static description = 'Show any PIMA resource record by name + id (generic).'
  static examples = ['<%= config.bin %> resource show coupons 42 --json']

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. coupons, vendors'}),
    id: Args.string({required: true, description: 'Record id'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, args.resource, args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
