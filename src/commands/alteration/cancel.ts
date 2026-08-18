import {Args, Flags} from '@oclif/core'
import {cancelAlteration} from '../../lib/alterations.js'
import {BaseCommand} from '../../lib/base.js'

export default class AlterationCancel extends BaseCommand {
  static description = 'Cancel an alteration without deleting its history. Requires scope: orders:write.'

  static examples = [
    '<%= config.bin %> alteration cancel 74902 --dry-run',
    '<%= config.bin %> alteration cancel 74902 --yes',
  ]

  static args = {id: Args.string({required: true, description: 'Alteration id'})}

  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(AlterationCancel)
    const path = `/alterations/${encodeURIComponent(args.id)}/cancel.json`

    try {
      if (flags['dry-run']) {
        this.log(`DRY RUN → POST ${path}`)
        return
      }

      if (!flags.yes) {
        this.log(`About to cancel alteration ${args.id} without deleting its history.`)
        this.log('Re-run with --yes to confirm (or --dry-run to preview).')
        return
      }

      const client = await this.client(flags.host)
      const data = await cancelAlteration(client, args.id)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Alteration ${args.id} canceled.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
