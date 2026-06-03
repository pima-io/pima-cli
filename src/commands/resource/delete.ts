import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {destroyResource} from '../../lib/resource.js'

// Generic destroy — gated server-side by the resource's <domain>:write scope.
export default class ResourceDelete extends BaseCommand {
  static description = 'Delete any PIMA resource record (generic write). Requires the resource domain :write scope.'
  static examples = ['<%= config.bin %> resource delete coupons 42 --yes']

  static args = {
    resource: Args.string({required: true, description: 'Resource name'}),
    id: Args.string({required: true, description: 'Record id'}),
  }
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceDelete)

    if (flags['dry-run']) {
      this.log(`DRY RUN → DELETE /${args.resource}/${args.id}.json`)
      return
    }
    if (!flags.yes) {
      this.log(`About to DELETE ${args.resource}/${args.id}. Re-run with --yes to confirm.`)
      return
    }

    try {
      const client = await this.client(flags.host)
      await destroyResource(client, args.resource, args.id)
      this.log(`✓ Deleted ${args.resource}/${args.id}.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
