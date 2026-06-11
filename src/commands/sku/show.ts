import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class SkuShow extends BaseCommand {
  static description =
    'Show SKU master data and detail. For availability/on-hand counts, prefer `pima inventory availability`. Requires scope: products:read.'

  static examples = ['<%= config.bin %> sku show BMFS.LSTEE --json']
  static args = {id: Args.string({required: true, description: 'SKU id, name, UPC, or legacy SKU'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(SkuShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'skus', skuLookupValue(args.id)), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}

// SKU names may contain dots (BMFS.LSTEE), which the server's /skus/:id route
// segment cannot match. The server resolves names dot-insensitively, so strip
// dots from non-numeric lookups to keep the route happy:
function skuLookupValue(value: string): string {
  return /^\d+$/.test(value) ? value : encodeURIComponent(value.replaceAll('.', ''))
}
