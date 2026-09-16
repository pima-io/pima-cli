import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyResourceAccess} from '../../lib/access.js'
import {resolveHost} from '../../lib/config.js'
import {resourceAppUrl} from '../../lib/links.js'
import {parseFilterPairs} from '../../lib/params.js'
import {previewResourceExport, showResourceExport, startResourceExport, type ResourceExport as ExportPayload} from '../../lib/resource.js'
import {downloadExport, waitForExport} from '../../lib/resource-export.js'

// Generic async CSV export for any React resource index. Mirrors the React UI's
// export endpoint and preserves the same query/filter/sort/view/owner context.
export default class ResourceExport extends BaseCommand {
  static description = 'Start a server-side CSV export for any PIMA resource index.'
  static examples = [
    '<%= config.bin %> resource export customers --q Dolph',
    '<%= config.bin %> resource export transfers --variant requests --filter status=pending',
    '<%= config.bin %> resource export orders --sort completed_at --direction desc --no-wait',
    '<%= config.bin %> resource export orders --filter sku_prefixes=BM17305.1609RIN,BM12160.1609RIN --filter fulfillment=awaiting --preset order_contacts --preview',
    '<%= config.bin %> resource export orders --filter product_ids=13127,13106 --filter fulfillment=awaiting --preset unique_emails --output emails.csv',
  ]

  static args = {resource: Args.string({required: true, description: 'Resource name, e.g. customers, orders, transfers'})}
  static flags = {
    q: Flags.string({description: 'Search query'}),
    preset: Flags.string({options: ['order_contacts', 'unique_emails'], description: 'Orders export contents. Requires orders:read and customers:read.'}),
    preview: Flags.boolean({description: 'Preview counts and resolved products/SKUs without creating an export'}),
    output: Flags.string({char: 'o', description: 'Download the completed export to this new file (does not overwrite)'}),
    variant: Flags.string({description: 'View variant, if the resource supports one'}),
    sort: Flags.string({description: 'Sort key'}),
    direction: Flags.string({options: ['asc', 'desc'], description: 'Sort direction'}),
    filter: Flags.string({char: 'f', multiple: true, description: 'Filter key=value (repeatable)'}),
    'owner-resource': Flags.string({description: 'Owner resource for nested indexes, e.g. customers'}),
    'owner-id': Flags.string({description: 'Owner record id for nested indexes'}),
    'legacy-path': Flags.string({description: 'Legacy path context to preserve server-side view routing'}),
    'to-email': Flags.boolean({description: 'Email the download link when the export completes'}),
    wait: Flags.boolean({allowNo: true, default: true, description: 'Poll until the export completes'}),
    timeout: Flags.integer({default: 300, description: 'Polling timeout in seconds'}),
    interval: Flags.integer({default: 2, description: 'Polling interval in seconds'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceExport)
    if (flags.preview && !flags.preset) this.error('--preview requires --preset.', {exit: 5})
    if (flags.preview && (flags.output || flags['to-email'])) this.error('--preview cannot be combined with --output or --to-email.', {exit: 5})
    if (flags.output && !flags.wait) this.error('--output requires --wait.', {exit: 5})
    if (flags.interval < 1 || flags.timeout < 1) this.error('--interval and --timeout must be positive.', {exit: 5})
    const params = {
      preset: flags.preset as 'order_contacts' | 'unique_emails' | undefined,
      q: flags.q,
      sort: flags.sort,
      direction: flags.direction,
      variant: flags.variant,
      legacy_path: flags['legacy-path'],
      owner_resource: flags['owner-resource'],
      owner_id: flags['owner-id'],
      filters: parseFilterPairs(flags.filter ?? []),
      to_email: flags['to-email'],
    }

    try {
      const resource = await verifyResourceAccess({host: flags.host, resource: args.resource, verb: 'read'})
      if (flags['dry-run']) {
        const host = await resolveHost(flags.host)
        this.log(`DRY RUN -> ${flags.preview ? 'GET' : 'POST'} /react_ui/resources/${resource.id}/${flags.preview ? 'export_preview' : 'export'}.json`)
        this.log(`View URL: ${resourceAppUrl(host, resource, params)}`)
        this.log(JSON.stringify(params, null, 2))
        return
      }

      const client = await this.client(flags.host)
      if (flags.preview) {
        const {preview} = await previewResourceExport(client, args.resource, params)
        this.log(flags.json ? JSON.stringify({preview}, null, 2) : renderPreview(preview))
        return
      }
      const started = await startResourceExport(client, args.resource, params)
      const result = flags.wait
        ? await waitForExport(
            () => showResourceExport(client, started.export.id),
            started.export,
            flags.interval * 1000,
            flags.timeout * 1000,
          )
        : started

      const savedTo = flags.output ? await downloadExport(result.export, flags.output) : undefined
      if (flags.json) {
        this.log(JSON.stringify({...result, ...(savedTo ? {saved_to: savedTo} : {})}, null, 2))
        return
      }

      this.log(renderExport(result.export, flags.wait))
      if (savedTo) this.log(`Saved: ${savedTo}`)
    } catch (error) {
      this.fail(error)
    }
  }
}

function renderPreview(preview: Record<string, any>): string {
  return [
    `${preview.orders} orders, ${preview.matching_units} matching units, ${preview.unique_emails} unique emails.`,
    `${preview.orders_missing_email} orders missing email.`,
    ...(preview.products ?? []).map((product: any) => `${product.name}: ${product.skus.map((sku: any) => sku.name).join(', ')}`),
    preview.unmatched?.length ? `No matching SKUs for: ${preview.unmatched.join(', ')}` : '',
    preview.source_snapshot?.snapshot_at ? `Data as of ${preview.source_snapshot.snapshot_at}` : '',
  ].filter(Boolean).join('\n')
}

function renderExport(exportData: ExportPayload, waited: boolean): string {
  const progress = `${exportData.progress ?? 0}/${exportData.total_records ?? 0}`
  if (exportData.status === 'completed') {
    return [
      `✓ Export completed #${exportData.id} (${progress} records).`,
      exportData.generation_duration_in_words && `Generated in ${exportData.generation_duration_in_words}.`,
      exportData.file_url && `Download: ${exportData.file_url}`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return waited
    ? `Export #${exportData.id} is still ${exportData.status} after the polling timeout (${progress} records). Check it with pima resource export-status ${exportData.id}.`
    : `✓ Export queued #${exportData.id} (${exportData.status}).`
}
