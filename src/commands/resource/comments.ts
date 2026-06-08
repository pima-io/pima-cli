import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {listResourceComments, type ResourceComments as CommentsPayload} from '../../lib/resource.js'

export default class ResourceComments extends BaseCommand {
  static description = 'List comments and mention metadata for a resource record.'
  static examples = [
    '<%= config.bin %> resource comments products 42',
    '<%= config.bin %> resource comments orders 123 --mentionables --json',
  ]

  static args = {
    resource: Args.string({required: true, description: 'Resource name, e.g. products'}),
    id: Args.string({required: true, description: 'Record id'}),
  }

  static flags = {
    mentionables: Flags.boolean({description: 'Include @-mentionable users/locations in human output'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceComments)

    try {
      const client = await this.client(flags.host)
      const payload = await listResourceComments(client, args.resource, args.id)
      if (flags.json) {
        this.log(JSON.stringify(payload, null, 2))
        return
      }

      this.log(renderComments(payload, flags.mentionables))
    } catch (error) {
      this.fail(error)
    }
  }
}

function renderComments(payload: CommentsPayload, includeMentionables: boolean): string {
  const out: string[] = []
  if (!payload.comments.length) {
    out.push('No comments.')
  } else {
    for (const comment of payload.comments) {
      const author = comment.author?.username ?? comment.author?.full_name ?? comment.author?.label ?? 'unknown'
      const mentioned = (comment.mentioned_users ?? [])
        .map((user) => user.username ?? user.full_name ?? user.label)
        .filter(Boolean)
      out.push(`#${comment.id} ${comment.created_at ?? ''} by ${author}`.trim())
      out.push(comment.text_md)
      if (mentioned.length) out.push(`Mentions: ${mentioned.map((name) => `@${name}`).join(', ')}`)
      if (comment.react_path) out.push(`URL path: ${comment.react_path}`)
      out.push('')
    }
    while (out[out.length - 1] === '') out.pop()
  }

  out.push(`Can create: ${payload.can_create ? 'yes' : 'no'}`)
  if (includeMentionables && payload.mentionables.length) {
    out.push(`Mentionables: ${payload.mentionables.map((item) => `@${item.name}`).join(', ')}`)
  }

  return out.join('\n')
}
