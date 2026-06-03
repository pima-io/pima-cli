import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {updateResource} from '../../lib/resource.js'

// Generic update — gated server-side by the resource's <domain>:write scope.
export default class ResourceUpdate extends BaseCommand {
  static description = 'Update any PIMA resource record (generic write). Requires the resource domain :write scope.'
  static examples = [
    `<%= config.bin %> resource update coupons 42 --data '{"amount":15}' --yes`,
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name'}),
    id: Args.string({required: true, description: 'Record id'}),
  }
  static flags = {
    data: Flags.string({required: true, description: 'JSON of the fields to change (see `resource fields <name>`)'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceUpdate)
    const body = {record: JSON.parse(flags.data)}

    if (flags['dry-run']) {
      this.log(`DRY RUN → PATCH /${args.resource}/${args.id}.json`)
      this.log(JSON.stringify(body, null, 2))
      return
    }
    if (!flags.yes) {
      this.log(`About to update ${args.resource}/${args.id}. Re-run with --yes to confirm (or --dry-run to preview).`)
      return
    }

    try {
      const client = await this.client(flags.host)
      const data = await updateResource(client, args.resource, args.id, body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Updated ${args.resource}/${args.id}.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
