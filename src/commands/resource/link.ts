import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {resolveHost} from '../../lib/config.js'
import {resourceAppPath, resourceAppUrl} from '../../lib/links.js'
import {fetchManifest, findResource} from '../../lib/manifest.js'
import {parseFilterPairs} from '../../lib/params.js'

export default class ResourceLink extends BaseCommand {
  static description = 'Print a direct Pima.io URL for a resource index, view, record, or form.'
  static examples = [
    '<%= config.bin %> resource link orders',
    '<%= config.bin %> resource link transfers --variant requests --filter status=pending',
    '<%= config.bin %> resource link customers 42',
    '<%= config.bin %> resource link customer_credits --action new',
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. orders, customer_credits'}),
    id: Args.string({description: 'Record id for show/edit links'}),
  }

  static flags = {
    action: Flags.string({options: ['index', 'show', 'new', 'edit'], description: 'Link type'}),
    q: Flags.string({description: 'Search query'}),
    page: Flags.integer({description: 'Page number'}),
    variant: Flags.string({description: 'View variant, if the resource supports one'}),
    sort: Flags.string({description: 'Sort key'}),
    direction: Flags.string({options: ['asc', 'desc'], description: 'Sort direction'}),
    filter: Flags.string({char: 'f', multiple: true, description: 'Filter key=value (repeatable)'}),
    anchor: Flags.string({description: 'URL fragment anchor, e.g. comment-123'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceLink)

    try {
      const manifest = await fetchManifest({host: flags.host})
      const resource = findResource(manifest, args.resource)
      if (!resource) this.error(`Unknown resource: ${args.resource}. Run \`pima resources\` to list them.`, {exit: 4})

      const opts = {
        action: flags.action as 'index' | 'show' | 'new' | 'edit' | undefined,
        id: args.id,
        q: flags.q,
        page: flags.page,
        variant: flags.variant,
        sort: flags.sort,
        direction: flags.direction,
        filters: parseFilterPairs(flags.filter ?? []),
        anchor: flags.anchor,
      }
      const host = await resolveHost(flags.host)
      const path = resourceAppPath(resource, opts)
      const url = resourceAppUrl(host, resource, opts)

      if (flags.json) {
        this.log(JSON.stringify({url, path}, null, 2))
        return
      }

      this.log(url)
    } catch (error) {
      this.fail(error)
    }
  }
}
