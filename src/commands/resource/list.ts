import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {resolveHost} from '../../lib/config.js'
import {resourceAppUrl} from '../../lib/links.js'
import {fetchManifest, findResource} from '../../lib/manifest.js'
import {parseFilterPairs} from '../../lib/params.js'
import {listResource} from '../../lib/resource.js'

// Generic escape hatch: list any PIMA catalog resource by name.
export default class ResourceList extends BaseCommand {
  static description = 'List any PIMA resource by name (generic). Scope depends on the resource domain.'
  static examples = [
    '<%= config.bin %> resource list coupons',
    '<%= config.bin %> resource list units --q AVAILABLE --page 2 --json',
  ]

  static args = {resource: Args.string({required: true, description: 'Resource name, e.g. coupons, units, vendors'})}
  static flags = {
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({default: 1}),
    variant: Flags.string({description: 'View variant, if the resource supports one'}),
    sort: Flags.string({description: 'Sort key'}),
    direction: Flags.string({options: ['asc', 'desc'], description: 'Sort direction'}),
    filter: Flags.string({char: 'f', multiple: true, description: 'Filter key=value (repeatable)'}),
    link: Flags.boolean({description: 'Print the matching Pima.io URL before the results'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceList)
    try {
      const client = await this.client(flags.host)
      const params = {
        q: flags.q,
        page: flags.page,
        variant: flags.variant,
        sort: flags.sort,
        direction: flags.direction,
        filters: parseFilterPairs(flags.filter ?? []),
      }
      if (flags.link) {
        const manifest = await fetchManifest({host: flags.host})
        const resource = findResource(manifest, args.resource)
        if (!resource) this.error(`Unknown resource: ${args.resource}. Run \`pima resources\` to list them.`, {exit: 4})
        this.log(`URL: ${resourceAppUrl(await resolveHost(flags.host), resource, params)}`)
      }

      const {records, columns} = await listResource(client, args.resource, {
        ...params,
      })
      this.printList(records, columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
