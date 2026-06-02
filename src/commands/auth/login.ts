import {Command, Flags} from '@oclif/core'
import {deviceLogin, writeToken} from '../../lib/auth.js'
import {resolveHost, saveConfig} from '../../lib/config.js'
import {READ_ONLY, ALL_SCOPES} from '../../lib/scopes.js'

export default class AuthLogin extends Command {
  static description = 'Authenticate to a PIMA instance via OAuth device flow (gh-style).'

  static examples = [
    '<%= config.bin %> auth login --host https://pima.buckmason.com',
    '<%= config.bin %> auth login --read-only',
    '<%= config.bin %> auth login --scopes orders:read,orders:write,inventory:read',
  ]

  static flags = {
    host: Flags.string({description: 'PIMA host URL (saved for future commands)'}),
    'read-only': Flags.boolean({description: 'Request the read_only preset (every <domain>:read)'}),
    scopes: Flags.string({description: 'Comma-separated scopes to request'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthLogin)
    const host = await resolveHost(flags.host)

    let scopes: string[]
    if (flags.scopes) scopes = flags.scopes.split(',').map((s) => s.trim())
    else if (flags['read-only']) scopes = READ_ONLY
    else scopes = ['reports:read'] // default; widen with --scopes / consent screen

    this.log(`Authenticating to ${host}…`)
    const token = await deviceLogin(host, scopes)
    await writeToken(host, token)
    if (flags.host) await saveConfig({host})

    this.log(`\n✓ Logged in to ${host}`)
    this.log(`  Scopes: ${token.scopes.join(', ') || '(none granted)'}`)
    void ALL_SCOPES // referenced for completion/help generation
  }
}
