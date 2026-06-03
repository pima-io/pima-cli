import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {createResource} from '../../lib/resource.js'

// Generic create — covers every catalog write (coupons, credits, invites,
// memos, cycle counts, inventory audits, returns...). Gated server-side by the
// resource's <domain>:write scope. Use `resource fields <name>` to see the keys.
export default class ResourceCreate extends BaseCommand {
  static description = 'Create any PIMA resource record (generic write). Requires the resource domain :write scope.'
  static examples = [
    `<%= config.bin %> resource create coupons --data '{"code":"VIP10","amount":10}' --yes`,
    `<%= config.bin %> resource create cycle_counts --data '{"location_id":7}' --yes`,
  ]

  static args = {resource: Args.string({required: true, description: 'Resource name, e.g. coupons, customer_credits'})}
  static flags = {
    data: Flags.string({required: true, description: 'JSON of the record fields (see `resource fields <name>`)'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceCreate)
    const body = {record: JSON.parse(flags.data)}

    if (flags['dry-run']) {
      this.log(`DRY RUN → POST /${args.resource}.json`)
      this.log(JSON.stringify(body, null, 2))
      return
    }
    if (!flags.yes) {
      this.log(`About to create a ${args.resource}. Re-run with --yes to confirm (or --dry-run to preview).`)
      return
    }

    try {
      const client = await this.client(flags.host)
      const data = await createResource(client, args.resource, body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Created ${args.resource}.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
