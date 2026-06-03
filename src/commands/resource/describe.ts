import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {fetchManifest, findResource} from '../../lib/manifest.js'
import {renderResourceDetail} from '../../lib/manifest-render.js'

// `pima resource describe <name>` — the full static contract for one resource
// from the API manifest: domain, scopes, search/filter params, create/update
// fields, member + collection actions, and paths. Complements
// `resource fields`, which only shows the live create form.
export default class ResourceDescribe extends BaseCommand {
  static description = "Describe a resource from the API manifest: scopes, search/filters, fields, actions, paths."
  static examples = [
    '<%= config.bin %> resource describe orders',
    '<%= config.bin %> resource describe purchase_order --json',
  ]

  static args = {
    name: Args.string({required: true, description: 'Resource id (singular or plural), e.g. orders, coupon'}),
  }

  static flags = {
    refresh: Flags.boolean({description: 'Bypass the cache and re-fetch the manifest'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceDescribe)
    try {
      const manifest = await fetchManifest({host: flags.host, refresh: flags.refresh})
      const resource = findResource(manifest, args.name)
      if (!resource) {
        this.error(`Unknown resource: ${args.name}. Run \`pima resources\` to list them.`, {exit: 4})
      }

      if (flags.json) {
        this.log(JSON.stringify(resource, null, 2))
        return
      }
      this.log(renderResourceDetail(resource))
    } catch (error) {
      this.fail(error)
    }
  }
}
