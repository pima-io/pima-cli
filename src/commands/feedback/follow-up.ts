import {Flags, Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {runFeedbackFollowUpCommand} from '../../lib/feedback-command.js'

export default class FeedbackFollowUp extends BaseCommand {
  static description = 'Ask a follow-up question on an existing PIMA feedback thread.'
  static examples = [
    '<%= config.bin %> feedback follow-up q_123 --message "What endpoint exposes that?"',
    '<%= config.bin %> feedback follow-up q_123 --message "Can you be more specific?" --no-wait',
  ]

  static args = {
    id: Args.string({required: true, description: 'Question thread id, e.g. q_123'}),
  }

  static flags = {
    message: Flags.string({required: true, description: 'Follow-up question'}),
    context: Flags.string({description: 'Additional sanitized JSON object'}),
    wait: Flags.boolean({allowNo: true, default: true, description: 'Poll until the async answer is ready'}),
    timeout: Flags.integer({default: 180, description: 'Polling timeout in seconds'}),
    interval: Flags.integer({default: 2, description: 'Polling interval in seconds'}),
    'dry-run': Flags.boolean({description: 'Print the follow-up payload without sending it'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(FeedbackFollowUp)
    try {
      await runFeedbackFollowUpCommand(this, args.id, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
