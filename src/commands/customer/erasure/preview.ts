import {Args, Flags} from '@oclif/core'
import {access} from 'node:fs/promises'
import {BaseCommand} from '../../../lib/base.js'
import {erasureSummary, previewErasurePlan, readErasureCsv, writeErasureFile} from '../../../lib/customer-erasure.js'

export default class ErasurePreview extends BaseCommand {
  static description = 'Resolve each CSV email and save a local customer-removal plan. Does not erase customer data.'
  static examples = ['<%= config.bin %> customer erasure preview requests.csv --out preview.json']
  static args = {file: Args.string({required: true, description: 'UTF-8 CSV exported from OneTrust or a spreadsheet'})}
  static flags = {
    out: Flags.string({required: true, description: 'New JSON preview file; existing files are never overwritten'}),
    'email-column': Flags.string({description: 'Email header override (default: Email or Email Address)'}),
    'request-id-column': Flags.string({description: 'Request ID header override (auto-detected when present)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ErasurePreview)
    try {
      const exists = await access(flags.out).then(() => true, () => false)
      if (exists) throw new Error('Output file already exists. Choose a new preview filename.')
      const csv = await readErasureCsv(args.file)
      const preview = await previewErasurePlan(await this.client(flags.host), csv, {
        emailColumn: flags['email-column'], requestIdColumn: flags['request-id-column'],
      })
      await writeErasureFile(flags.out, JSON.stringify(preview, null, 2) + '\n')
      this.log(flags.json ? JSON.stringify(preview, null, 2) : erasureSummary(preview) + `\nSaved local plan: ${flags.out}\nReview its rows before submitting.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
