import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {verifyMemberActionAccess} from '../../lib/access.js'
import {memberAction} from '../../lib/resource.js'

export default class TransferBoxSetFound extends BaseCommand {
  static description = 'Mark a transfer box as found. Requires scope: transfers:write.'
  static examples = ['<%= config.bin %> transfer-box set-found 88 --yes']
  static args = {id: Args.string({required: true, description: 'Transfer box id'})}
  static flags = {
    'dry-run': Flags.boolean({description: 'Print the request without sending it'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TransferBoxSetFound)
    try {
      if (flags['dry-run']) {
        await verifyMemberActionAccess({host: flags.host, resource: 'transfer_boxes', action: 'set_found', method: 'POST'})
        this.log(`DRY RUN → POST /transfer_boxes/${args.id}/set_found`)
        return
      }
      if (!flags.yes) {
        this.log(`About to mark transfer box ${args.id} found. Re-run with --yes to confirm.`)
        return
      }

      const client = await this.client(flags.host)
      await memberAction(client, 'POST', 'transfer_boxes', args.id, 'set_found')
      this.log(`✓ Transfer box ${args.id} marked found.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
