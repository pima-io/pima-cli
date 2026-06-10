import {Command, Flags} from '@oclif/core'
import {deviceLogin, writeToken} from '../../lib/auth.js'
import {clearManifestCache} from '../../lib/manifest.js'
import {resolveHost, saveConfig} from '../../lib/config.js'
import {READ_ONLY, ALL_SCOPES} from '../../lib/scopes.js'

export default class AuthLogin extends Command {
  static description = 'Authenticate to a PIMA instance via OAuth device flow (gh-style).'

  static examples = [
    '<%= config.bin %> auth login --host https://pima.io',
    '<%= config.bin %> auth login --read-only',
    '<%= config.bin %> auth login --scopes orders:read,orders:write,inventory:read',
  ]

  static flags = {
    host: Flags.string({description: 'PIMA host URL (saved for future commands)'}),
    'read-only': Flags.boolean({
      description: 'Request strictly the read_only preset (every <domain>:read), without the default feedback:write',
    }),
    scopes: Flags.string({description: 'Comma-separated scopes to request'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthLogin)
    const host = await resolveHost(flags.host)

    let scopes: string[]
    if (flags.scopes) scopes = flags.scopes.split(',').map((s) => s.trim())
    else if (flags['read-only']) scopes = READ_ONLY
    // default: every <domain>:read plus feedback:write (file bugs / ask questions);
    // widen with --scopes / consent screen
    else scopes = [...READ_ONLY, 'feedback:write']

    this.log(`Authenticating to ${host}…`)
    const token = await deviceLogin(host, scopes)
    await writeToken(host, token)
    // The manifest is gated by scopes; a new token may resolve a different
    // surface, so drop any cached manifest for this host.
    await clearManifestCache(host)
    if (flags.host) await saveConfig({host})

    this.log(`\n✓ Logged in to ${host}`)
    this.log(`  Scopes: ${token.scopes.join(', ') || '(none granted)'}`)
    this.log('\nAgent starting points:')
    this.log('  pima questions             example business questions and optimized commands')
    this.log('  pima skill getting-started first-run orientation')
    this.log('  pima skill --all           full agent domain briefing')
    void ALL_SCOPES // referenced for completion/help generation
  }
}
