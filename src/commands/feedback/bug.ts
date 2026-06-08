import {BaseCommand} from '../../lib/base.js'
import {feedbackFlags, runFeedbackCommand} from '../../lib/feedback-command.js'

export default class FeedbackBug extends BaseCommand {
  static description = 'File a PIMA bug report as a GitHub issue. Bugs are Codex PR candidates by default.'
  static examples = [
    '<%= config.bin %> feedback bug --title "Order export returns 500" --request-id req_123 --status 500 --yes',
    '<%= config.bin %> feedback bug --title "Transfer view crashes" --context \'{"resource":"transfers"}\' --dry-run',
  ]

  static flags = feedbackFlags

  async run(): Promise<void> {
    const {flags} = await this.parse(FeedbackBug)
    try {
      await runFeedbackCommand(this, 'bug', flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
