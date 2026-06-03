import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {memberAction} from '../../lib/resource.js'

export default class TransferBoxSetMissing extends BaseCommand {
  static description = 'Mark a transfer box as missing. Requires scope: transfers:write.'
  static examples = ['<%= config.bin %> transfer-box set-missing 88 --yes']
  static args = {id: Args.string({required: true, description: 'Transfer box id'})}
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TransferBoxSetMissing)
    if (flags['dry-run']) {
      this.log(`DRY RUN → POST /transfer_boxes/${args.id}/set_missing`)
      return
    }
    if (!flags.yes) {
      this.log(`About to mark transfer box ${args.id} missing. Re-run with --yes to confirm.`)
      return
    }

    try {
      const client = await this.client(flags.host)
      await memberAction(client, 'POST', 'transfer_boxes', args.id, 'set_missing')
      this.log(`✓ Transfer box ${args.id} marked missing.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
