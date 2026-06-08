import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyMemberActionAccess} from '../../lib/access.js'
import {memberAction} from '../../lib/resource.js'

// Generic escape hatch for member actions: <method> /<resource>/:id/<verb>.json
// Lets you reach write verbs that don't yet have a dedicated command.
export default class ResourceAction extends BaseCommand {
  static description = 'Run a member action on a resource record (generic write escape hatch). Requires the matching :write scope.'
  static examples = [
    '<%= config.bin %> resource action purchase_orders 13529 accept --method get',
    '<%= config.bin %> resource action transfer_boxes 88 set_missing --yes',
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. purchase_orders'}),
    id: Args.string({required: true, description: 'Record id'}),
    verb: Args.string({required: true, description: 'Member action, e.g. accept, undo, set_missing'}),
  }

  static flags = {
    method: Flags.string({options: ['get', 'post', 'patch'], default: 'post', description: 'HTTP method'}),
    data: Flags.string({description: 'JSON request body'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceAction)
    const method = flags.method.toUpperCase() as 'GET' | 'POST' | 'PATCH'
    const body = flags.data ? JSON.parse(flags.data) : undefined
    const path = `/${args.resource}/${args.id}/${args.verb}`

    try {
      if (flags['dry-run']) {
        const checked = await verifyMemberActionAccess({
          host: flags.host,
          resource: args.resource,
          action: args.verb,
          method,
        })
        const manifestPath = checked.action.path.replace(/\{id\}/g, args.id)
        this.log(`DRY RUN → ${method} ${manifestPath}.json`)
        if (body) this.log(JSON.stringify(body, null, 2))
        return
      }
      if (!flags.yes) {
        this.log(`About to ${method} ${path}. Re-run with --yes to confirm (or --dry-run to preview).`)
        return
      }

      const client = await this.client(flags.host)
      const data = await memberAction(client, method, args.resource, args.id, args.verb, body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ ${args.resource}/${args.id} ${args.verb} done.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
