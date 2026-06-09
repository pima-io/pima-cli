import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class SkuShow extends BaseCommand {
  static description =
    'Show SKU master data and detail. For availability/on-hand counts, prefer `pima inventory availability`. Requires scope: products:read.'

  static examples = ['<%= config.bin %> sku show BMSKUJY3 --json']
  static args = {id: Args.string({required: true, description: 'SKU id, name, UPC, or legacy SKU'})}

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
