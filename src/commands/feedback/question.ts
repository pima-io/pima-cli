import {BaseCommand} from '../../lib/base.js'
import {questionFlags, runQuestionCommand} from '../../lib/feedback-command.js'

export default class FeedbackQuestion extends BaseCommand {
  static description = 'Ask a PIMA product or implementation question. Answers are generated asynchronously by a read-only Codex thread.'
  static examples = [
    '<%= config.bin %> feedback question --title "Which resource owns transfer damage state?"',
    '<%= config.bin %> feedback question --title "Which endpoint owns this?" --no-wait',
  ]

  static flags = questionFlags

  async run(): Promise<void> {
    const {flags} = await this.parse(FeedbackQuestion)
    try {
      await runQuestionCommand(this, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
