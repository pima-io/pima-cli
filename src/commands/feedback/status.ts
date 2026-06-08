import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {runFeedbackStatusCommand, waitFlags} from '../../lib/feedback-command.js'

export default class FeedbackStatus extends BaseCommand {
  static description = 'Show a PIMA feedback question thread status and answer.'
  static examples = [
    '<%= config.bin %> feedback status q_123',
    '<%= config.bin %> feedback status q_123 --wait',
  ]

  static args = {
    id: Args.string({required: true, description: 'Question thread id, e.g. q_123'}),
  }

  static flags = waitFlags

  async run(): Promise<void> {
    const {args, flags} = await this.parse(FeedbackStatus)
    try {
      await runFeedbackStatusCommand(this, args.id, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
