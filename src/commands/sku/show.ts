import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class SkuShow extends BaseCommand {
  static description = 'Show a SKU with its inventory detail. Requires scope: products:read.'
  static examples = ['<%= config.bin %> sku show 8842 --json']
  static args = {id: Args.string({required: true, description: 'SKU id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SkuShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'skus', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
