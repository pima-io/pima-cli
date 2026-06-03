import {Command, Flags} from '@oclif/core'
import {deleteToken} from '../../lib/auth.js'
import {clearManifestCache} from '../../lib/manifest.js'
import {resolveHost} from '../../lib/config.js'

export default class AuthLogout extends Command {
  static description = 'Remove the stored token for a PIMA host.'

  static flags = {
    host: Flags.string({description: 'PIMA host URL'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthLogout)
    const host = await resolveHost(flags.host)
    const removed = await deleteToken(host)
    // Drop any manifest cached under the removed token for this host.
    await clearManifestCache(host)
    this.log(removed ? `✓ Logged out of ${host}` : `No stored token for ${host}.`)
  }
}
