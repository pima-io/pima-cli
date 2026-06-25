import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {loginMetabaseCli, requestMetabaseCliKey} from '../../lib/metabase.js'

export default class MetabaseLogin extends BaseCommand {
  static description =
    'Provision Metabase access for the current PIMA user and authenticate the official `mb` CLI. Requires PIMA scope: reports:read.'

  static examples = [
    '<%= config.bin %> metabase login',
    '<%= config.bin %> metabase login --profile pima-production',
    '<%= config.bin %> metabase login --skip-install',
    '<%= config.bin %> metabase login --mb-command /opt/homebrew/bin/mb',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    profile: Flags.string({description: 'Metabase CLI profile name. Defaults to the profile returned by PIMA.'}),
    'mb-command': Flags.string({description: 'Metabase CLI executable path/name', default: 'mb'}),
    'skip-install': Flags.boolean({
      description: 'Do not install @metabase/cli automatically when the default `mb` command is missing.',
      default: false,
    }),
    keyring: Flags.boolean({
      description: 'Let `mb` store the key in the OS keychain instead of its local 0600 profile file.',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetabaseLogin)

    try {
      const client = await this.client(flags.host)
      const result = await requestMetabaseCliKey(client)
      const metabase = result.key
      await loginMetabaseCli(metabase, {
        profile: flags.profile,
        command: flags['mb-command'],
        disableKeyring: !flags.keyring,
        autoInstall: !flags['skip-install'],
        onInstallStart: () => {
          this.log('Metabase CLI `mb` was not found. Installing @metabase/cli...')
        },
      })

      const profile = flags.profile ?? metabase.profile
      if (flags.json) {
        this.log(JSON.stringify({
          metabase_url: metabase.url,
          profile,
          key_id: metabase.key_id,
          key_name: metabase.key_name,
          group_id: metabase.group_id,
          metabase_user: result.user,
          keyring: flags.keyring,
          auto_install: !flags['skip-install'],
        }, null, 2))
      } else {
        this.log(`Logged in to Metabase ${metabase.url}`)
        this.log(`  Profile: ${profile}`)
        if (metabase.key_name) this.log(`  Key:     ${metabase.key_name}`)
        this.log('\nTry:')
        this.log(`  mb card list --profile ${profile}`)
        this.log(`  mb card query <id> --profile ${profile} --export-format csv > results.csv`)
      }
    } catch (error) {
      this.fail(error)
    }
  }
}
