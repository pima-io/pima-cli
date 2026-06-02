import {Command, Flags} from '@oclif/core'
import {Client, ApiError} from '../../lib/client.js'
import {renderList, type OutputFormat} from '../../lib/output.js'

export default class OrdersList extends Command {
  static description = 'List orders. Requires scope: orders:read.'

  static examples = [
    '<%= config.bin %> orders list --status shippable',
    '<%= config.bin %> orders list --q "smith" --json',
  ]

  static flags = {
    host: Flags.string({description: 'PIMA host URL'}),
    status: Flags.string({description: 'Filter by status / view variant'}),
    location: Flags.integer({description: 'Filter by location id'}),
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
    json: Flags.boolean({description: 'Output raw lean JSON'}),
    csv: Flags.boolean({description: 'Output CSV'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(OrdersList)
    const format: OutputFormat = flags.json ? 'json' : flags.csv ? 'csv' : 'table'

    const params = new URLSearchParams()
    if (flags.status) params.set('variant', flags.status)
    if (flags.location) params.set('location_id', String(flags.location))
    if (flags.q) params.set('q', flags.q)
    params.set('page', String(flags.page))

    try {
      const client = await Client.create({host: flags.host})
      const data = await client.get(`/orders.json?${params}`)
      const columns = (data.resource?.columns ?? []).map((c: any) => ({key: c.key, label: c.label}))
      this.log(renderList(data.records ?? [], columns, format))
    } catch (error) {
      this.handle(error)
    }
  }

  private handle(error: unknown): never {
    if (error instanceof ApiError) {
      if (error.status === 403) this.error('Forbidden — token lacks the orders:read scope.', {exit: 3})
      this.error(error.message, {exit: error.status === 404 ? 4 : 1})
    }
    const e = error as any
    this.error(e.message ?? String(error), {exit: e.exitCode ?? 1})
  }
}
