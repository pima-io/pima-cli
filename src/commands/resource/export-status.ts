import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResourceExport} from '../../lib/resource.js'
import {downloadExport} from '../../lib/resource-export.js'

export default class ResourceExportStatus extends BaseCommand {
  static description = 'Check an existing export and optionally download its completed file.'
  static examples = ['<%= config.bin %> resource export-status 123 --output orders.csv']
  static args = {id: Args.integer({required: true, description: 'Export ID returned by resource export'})}
  static flags = {output: Flags.string({char: 'o', description: 'Download the completed export to this new file (does not overwrite)'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceExportStatus)
    try {
      const result = await showResourceExport(await this.client(flags.host), args.id)
      const savedTo = flags.output ? await downloadExport(result.export, flags.output) : undefined
      if (flags.json) {
        this.log(JSON.stringify({...result, ...(savedTo ? {saved_to: savedTo} : {})}, null, 2))
      } else {
        this.log(`Export #${result.export.id}: ${result.export.status}`)
        if (result.export.error_message) this.log(result.export.error_message)
        if (savedTo) this.log(`Saved: ${savedTo}`)
        else if (result.export.file_url) this.log(`Download: ${result.export.file_url}`)
      }
    } catch (error) {
      this.fail(error)
    }
  }
}
