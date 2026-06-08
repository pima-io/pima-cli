import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {resolveHost} from '../../lib/config.js'
import {resourceAppUrl} from '../../lib/links.js'
import {fetchManifest, findResource} from '../../lib/manifest.js'
import {showResource} from '../../lib/resource.js'

// Generic escape hatch: show any PIMA catalog resource record by name + id.
export default class ResourceShow extends BaseCommand {
  static description = 'Show any PIMA resource record by name + id (generic).'
  static examples = ['<%= config.bin %> resource show coupons 42 --json']

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. coupons, vendors'}),
    id: Args.string({required: true, description: 'Record id'}),
  }
  static flags = {
    link: Flags.boolean({description: 'Print the Pima.io URL before the record'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceShow)
    try {
      if (flags.link) {
        const manifest = await fetchManifest({host: flags.host})
        const resource = findResource(manifest, args.resource)
        if (!resource) this.error(`Unknown resource: ${args.resource}. Run \`pima resources\` to list them.`, {exit: 4})
        this.log(`URL: ${resourceAppUrl(await resolveHost(flags.host), resource, {id: args.id})}`)
      }

      const client = await this.client(flags.host)
      this.printShow(await showResource(client, args.resource, args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
