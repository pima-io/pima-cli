import {Args, Command, Flags} from '@oclif/core'
import {Client, ApiError} from '../../lib/client.js'

// Flagship write command. Maps to the session-independent RESTful order-item
// update endpoint (PATCH /order_items/:id), gated server-side by orders:write.
// Deliberately NOT the POS cart endpoint — that requires a POS session/clock-in.
export default class OrderItemReroute extends Command {
  static description = "Reroute an order item to a different fulfillment location. Requires scope: orders:write."

  static examples = [
    '<%= config.bin %> order-item reroute 12345 --to 7',
    '<%= config.bin %> order-item reroute 12345 --to 7 --dry-run',
  ]

  static args = {
    id: Args.integer({required: true, description: 'OrderItem id'}),
  }

  static flags = {
    host: Flags.string({description: 'PIMA host URL'}),
    to: Flags.integer({required: true, description: 'Destination fulfillment location id'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(OrderItemReroute)
    const path = `/order_items/${args.id}`
    const body = {order_item: {fulfillment_location_id: flags.to}}

    if (flags['dry-run']) {
      this.log(`DRY RUN → PATCH ${path}`)
      this.log(JSON.stringify(body, null, 2))
      return
    }

    if (!flags.yes) {
      this.log(`About to reroute order item ${args.id} → location ${flags.to}.`)
      this.log('Re-run with --yes to confirm (or --dry-run to preview).')
      this.exit(0)
    }

    try {
      const client = await Client.create({host: flags.host})
      await client.patch(path, body)
      this.log(`✓ Order item ${args.id} rerouted to location ${flags.to}.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        this.error('Forbidden — token lacks the orders:write scope.', {exit: 3})
      }
      const e = error as any
      this.error(e.message ?? String(error), {exit: e.exitCode ?? 1})
    }
  }
}
