import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {showResource} from '../../lib/resource.js'

export default class TransferShow extends BaseCommand {
  static description = 'Show a transfer. Requires scope: transfers:read.'
  static args = {id: Args.string({required: true, description: 'Transfer id'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TransferShow)
    try {
      const client = await this.client(flags.host)
      this.printShow(await showResource(client, 'transfers', args.id), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
