import {Args} from '@oclif/core'
import {BaseCommand} from '../lib/base.js'

export default class Search extends BaseCommand {
  static description = 'Sitewide search across PIMA (orders, products, SKUs, customers...). Requires scope: reports:read.'
  static examples = ['<%= config.bin %> search "BMTSW001"', '<%= config.bin %> search smith --json']
  static args = {query: Args.string({required: true, description: 'Search query'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Search)
    try {
      const client = await this.client(flags.host)
      const data = await client.get(`/search.json?q=${encodeURIComponent(args.query)}`)
      this.log(JSON.stringify(data, null, 2))
    } catch (error) {
      this.fail(error)
    }
  }
}
