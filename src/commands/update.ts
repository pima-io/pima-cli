import {Command, Flags} from '@oclif/core'
import {buildUpdateCommand, DEFAULT_UPDATE_PACKAGE, runUpdateCommand} from '../lib/update.js'

export default class Update extends Command {
  static description = 'Install the latest PIMA CLI from npm.'

  static examples = ['<%= config.bin %> update', '<%= config.bin %> update --dry-run']

  static flags = {
    'dry-run': Flags.boolean({description: 'Print the npm install command without running it'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Update)
    const updateCommand = buildUpdateCommand(DEFAULT_UPDATE_PACKAGE)

    if (flags['dry-run']) {
      this.log(updateCommand.display)
      return
    }

    this.log(`Running: ${updateCommand.display}`)
    try {
      await runUpdateCommand(updateCommand)
    } catch (error) {
      const e = error as {message?: string; exitCode?: number}
      this.error(e.message ?? String(error), {exit: e.exitCode ?? 1})
    }
    this.log('PIMA CLI update complete. Run `pima --version` to confirm.')
  }
}
