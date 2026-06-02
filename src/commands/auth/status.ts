import {Command, Flags} from '@oclif/core'
import {readToken} from '../../lib/auth.js'
import {resolveHost} from '../../lib/config.js'

export default class AuthStatus extends Command {
  static description = 'Show the current authentication state and granted scopes.'

  static flags = {
    host: Flags.string({description: 'PIMA host URL'}),
    json: Flags.boolean({description: 'Output as JSON'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(AuthStatus)
    const host = await resolveHost(flags.host)
    const token = await readToken(host)

    if (!token) {
      if (flags.json) this.log(JSON.stringify({host, authenticated: false}))
      else this.log(`Not authenticated to ${host}. Run \`pima auth login\`.`)
      this.exit(3)
    }

    const expires = token!.expires_at ? new Date(token!.expires_at * 1000).toISOString() : 'n/a'
    if (flags.json) {
      this.log(JSON.stringify({host, authenticated: true, scopes: token!.scopes, expires_at: expires}))
    } else {
      this.log(`✓ Authenticated to ${host}`)
      this.log(`  Scopes:  ${token!.scopes.join(', ') || '(unknown — using PIMA_TOKEN)'}`)
      this.log(`  Expires: ${expires}`)
    }
  }
}
