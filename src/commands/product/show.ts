import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class ProductShow extends BaseCommand {
  static description = 'Show a product with its detail. Requires scope: products:read.'
  static examples = ['<%= config.bin %> product show 1422 --json']
  static args = {id: Args.string({required: true, description: 'Product id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ProductShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'products', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
