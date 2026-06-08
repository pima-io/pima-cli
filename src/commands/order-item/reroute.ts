import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyResourceAccess} from '../../lib/access.js'

// Flagship write command. Maps to the session-independent RESTful order-item
// update endpoint (PATCH /order_items/:id), gated server-side by orders:write.
// Deliberately NOT the POS cart endpoint — that requires a POS session/clock-in.
export default class OrderItemReroute extends BaseCommand {
  static description = "Reroute an order item to a different fulfillment location. Requires scope: orders:write."

  static examples = [
    '<%= config.bin %> order-item reroute 12345 --to 7',
    '<%= config.bin %> order-item reroute 12345 --to 7 --dry-run',
  ]

  static args = {id: Args.string({required: true, description: 'OrderItem id'})}

  static flags = {
    to: Flags.integer({required: true, description: 'Destination fulfillment location id'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(OrderItemReroute)
    const path = `/order_items/${args.id}`
    const body = {order_item: {fulfillment_location_id: flags.to}}

    try {
      if (flags['dry-run']) {
        await verifyResourceAccess({host: flags.host, resource: 'order_items', verb: 'update'})
        this.log(`DRY RUN → PATCH ${path}`)
        this.log(JSON.stringify(body, null, 2))
        return
      }
      if (!flags.yes) {
        this.log(`About to reroute order item ${args.id} → location ${flags.to}.`)
        this.log('Re-run with --yes to confirm (or --dry-run to preview).')
        return
      }

      const client = await this.client(flags.host)
      const data = await client.patch(path, body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Order item ${args.id} rerouted to location ${flags.to}.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
