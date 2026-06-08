import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {fetchManifest, findResource} from '../../lib/manifest.js'
import {resourceHistory, type VersionHistory} from '../../lib/resource.js'

export default class ResourceHistory extends BaseCommand {
  static description = 'Show PaperTrail history for a resource record.'
  static examples = [
    '<%= config.bin %> resource history order_items 12345',
    '<%= config.bin %> resource history customer_credits 42 --page 2 --json',
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. order_items'}),
    id: Args.string({required: true, description: 'Record id'}),
  }

  static flags = {
    page: Flags.integer({default: 1, description: 'History page'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceHistory)

    try {
      const manifest = await fetchManifest({host: flags.host})
      const resource = findResource(manifest, args.resource)
      if (!resource) this.error(`Unknown resource: ${args.resource}. Run \`pima resources\` to list them.`, {exit: 4})
      if (!resource.access?.read) this.error(`Forbidden — no read access to ${resource.id}.`, {exit: 3})
      if (!resource.model) this.error(`${resource.id} does not expose a model name for history lookup.`, {exit: 4})

      const client = await this.client(flags.host)
      const history = await resourceHistory(client, resource.model, args.id, flags.page)
      if (flags.json) {
        this.log(JSON.stringify(history, null, 2))
        return
      }

      this.log(renderHistory(history))
    } catch (error) {
      this.fail(error)
    }
  }
}

function renderHistory(history: VersionHistory): string {
  const out: string[] = []
  out.push(`${history.label} (${history.item_type} #${history.item_id})`)
  if (!history.versions.length) {
    out.push('No history entries.')
    return out.join('\n')
  }

  for (const version of history.versions) {
    const author = version.author?.username ?? version.author?.full_name ?? version.author?.label
    out.push('')
    out.push(`${version.label} ${version.created_at ?? ''}${author ? ` by ${author}` : ''}`.trim())
    for (const change of version.changes ?? []) {
      out.push(`  ${change.label}: ${formatChange(change.from)} -> ${formatChange(change.to)}`)
    }
  }

  if (history.pagination && history.pagination.total_pages > history.pagination.page) {
    out.push('')
    out.push(`More history available: page ${history.pagination.page + 1}/${history.pagination.total_pages}`)
  }

  return out.join('\n')
}

function formatChange(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(blank)'
  if (typeof value === 'object') {
    const object = value as {label?: string}
    return object.label ?? JSON.stringify(value)
  }
  return String(value)
}
