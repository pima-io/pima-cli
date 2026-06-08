import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyResourceAccess} from '../../lib/access.js'
import {resolveHost} from '../../lib/config.js'
import {resourceAppUrl} from '../../lib/links.js'
import {parseFilterPairs} from '../../lib/params.js'
import {showResourceExport, startResourceExport, type ResourceExport as ExportPayload} from '../../lib/resource.js'

// Generic async CSV export for any React resource index. Mirrors the React UI's
// export endpoint and preserves the same query/filter/sort/view/owner context.
export default class ResourceExport extends BaseCommand {
  static description = 'Start a server-side CSV export for any PIMA resource index.'
  static examples = [
    '<%= config.bin %> resource export customers --q Dolph',
    '<%= config.bin %> resource export transfers --variant requests --filter status=pending',
    '<%= config.bin %> resource export orders --sort completed_at --direction desc --no-wait',
  ]

  static args = {resource: Args.string({required: true, description: 'Resource name, e.g. customers, orders, transfers'})}
  static flags = {
    q: Flags.string({description: 'Search query'}),
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
    const params = {
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
        this.log(`DRY RUN -> POST /react_ui/resources/${resource.id}/export.json`)
        this.log(`View URL: ${resourceAppUrl(host, resource, params)}`)
        this.log(JSON.stringify(params, null, 2))
        return
      }

      const client = await this.client(flags.host)
      const started = await startResourceExport(client, args.resource, params)
      const result = flags.wait
        ? await pollExport(
            () => showResourceExport(client, started.export.id),
            started.export,
            flags.interval * 1000,
            flags.timeout * 1000,
          )
        : started

      if (flags.json) {
        this.log(JSON.stringify(result, null, 2))
        return
      }

      this.log(renderExport(result.export, flags.wait))
    } catch (error) {
      this.fail(error)
    }
  }
}

async function pollExport(
  load: () => Promise<{export: ExportPayload}>,
  initial: ExportPayload,
  intervalMs: number,
  timeoutMs: number,
): Promise<{export: ExportPayload}> {
  let current = initial
  const deadline = Date.now() + timeoutMs

  while (!terminal(current.status) && Date.now() < deadline) {
    await sleep(intervalMs)
    current = (await load()).export
  }

  if (current.status === 'failed') {
    const err: any = new Error(current.error_message || `Export ${current.id} failed.`)
    err.exitCode = 1
    throw err
  }

  return {export: current}
}

function terminal(status: string): boolean {
  return status === 'completed' || status === 'failed'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    ? `Export #${exportData.id} is still ${exportData.status} after the polling timeout (${progress} records).`
    : `✓ Export queued #${exportData.id} (${exportData.status}).`
}
