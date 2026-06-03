import {Flags} from '@oclif/core'
import {BaseCommand} from '../lib/base.js'
import {fetchManifest, type ManifestResource} from '../lib/manifest.js'
import {accessCell} from '../lib/manifest-render.js'

// `pima resources` — the catalog of everything the server exposes, discovered
// live from /api_manifest.json (cached). The entry point for agent
// introspection: see what exists, then `pima resource describe <name>`.
export default class Resources extends BaseCommand {
  static description = 'List every PIMA resource the server exposes (from the live API manifest).'
  static examples = [
    '<%= config.bin %> resources',
    '<%= config.bin %> resources --domain orders',
    '<%= config.bin %> resources --refresh --json',
  ]

  static flags = {
    domain: Flags.string({description: 'Filter to one domain (e.g. orders, inventory)'}),
    refresh: Flags.boolean({description: 'Bypass the cache and re-fetch the manifest'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Resources)
    try {
      const manifest = await fetchManifest({host: flags.host, refresh: flags.refresh})
      let resources = manifest.resources ?? []
      if (flags.domain) resources = resources.filter((r) => r.domain === flags.domain)

      if (flags.json) {
        this.log(JSON.stringify(resources, null, 2))
        return
      }

      const rows = resources.map((r) => ({
        id: r.id,
        domain: r.domain ?? '',
        scopes: scopesCell(r),
        access: accessCell(r.access),
        fields: String((r.fields ?? []).length),
        filters: String((r.filters ?? []).length),
        actions: String((r.member_actions ?? []).length + (r.collection_actions ?? []).length),
      }))

      this.printList(
        rows,
        [
          {key: 'id', label: 'Resource'},
          {key: 'domain', label: 'Domain'},
          {key: 'scopes', label: 'Scopes'},
          {key: 'access', label: 'Access'}, // r/c/u/d the current token can do
          {key: 'fields', label: '#Fields'},
          {key: 'filters', label: '#Filters'},
          {key: 'actions', label: '#Actions'},
        ],
        flags,
      )
    } catch (error) {
      this.fail(error)
    }
  }
}

function scopesCell(r: ManifestResource): string {
  if (!r.scopes) return 'public'
  return [r.scopes.read && `r:${r.scopes.read}`, r.scopes.write && `w:${r.scopes.write}`].filter(Boolean).join(' ') || '-'
}
