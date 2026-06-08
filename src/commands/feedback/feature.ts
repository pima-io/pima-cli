import {BaseCommand} from '../../lib/base.js'
import {feedbackFlags, runFeedbackCommand} from '../../lib/feedback-command.js'

export default class FeedbackFeature extends BaseCommand {
  static description = 'Request a PIMA feature as a GitHub issue. Features are Codex PR candidates by default.'
  static examples = [
    '<%= config.bin %> feedback feature --title "Add saved transfer filters" --description "Agents need reusable views." --yes',
  ]

  static flags = feedbackFlags

  async run(): Promise<void> {
    const {flags} = await this.parse(FeedbackFeature)
    try {
      await runFeedbackCommand(this, 'feature', flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
