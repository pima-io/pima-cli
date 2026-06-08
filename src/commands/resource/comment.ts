import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {createResourceComment, listResourceComments} from '../../lib/resource.js'

export default class ResourceComment extends BaseCommand {
  static description = 'Create a comment on a resource record. @mentions are resolved by PIMA.'
  static examples = [
    '<%= config.bin %> resource comment products 42 --text "Please review @nick" --yes',
    '<%= config.bin %> resource comment orders 123 --text "Check address @cx" --dry-run',
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. products'}),
    id: Args.string({required: true, description: 'Record id'}),
  }

  static flags = {
    text: Flags.string({required: true, description: 'Markdown comment body'}),
    'dry-run': Flags.boolean({description: 'Verify access and print the request without creating the comment'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceComment)

    try {
      if (flags['dry-run']) {
        const thread = await listResourceComments(await this.client(flags.host), args.resource, args.id)
        if (!thread.can_create) this.error('Forbidden — your PIMA role cannot create comments.', {exit: 3})
        this.log(`DRY RUN → POST /comments.json?resource=${args.resource}&record_id=${args.id}`)
        this.log(JSON.stringify({comment: {text_md: flags.text}}, null, 2))
        return
      }

      if (!flags.yes) {
        this.log(`About to comment on ${args.resource}/${args.id}. Re-run with --yes to confirm (or --dry-run to preview).`)
        return
      }

      const client = await this.client(flags.host)
      const data = await createResourceComment(client, args.resource, args.id, flags.text)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ Comment #${data.comment.id} created.`)
    } catch (error) {
      this.fail(error)
    }
  }
}
