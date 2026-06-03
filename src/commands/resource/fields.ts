import {Args} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'

// Self-documenting: fetch a resource's create form schema so you know exactly
// what to pass to `resource create`. GET /<resource>/new.json.
export default class ResourceFields extends BaseCommand {
  static description = "Show a resource's create form fields (keys, types, required) for use with `resource create`."
  static examples = ['<%= config.bin %> resource fields customer_credits', '<%= config.bin %> resource fields coupons --json']
  static args = {resource: Args.string({required: true, description: 'Resource name'})}

  async run(): Promise<void> {
    const {args, flags} = await this.parse(ResourceFields)
    try {
      const client = await this.client(flags.host)
      const data = await client.get(`/${args.resource}/new.json`)
      const fields = (data.form?.fields ?? []).map((f: any) => ({
        key: f.key,
        type: f.type,
        required: !!f.required,
        label: f.label,
      }))
      this.printList(fields, [
        {key: 'key', label: 'Key'},
        {key: 'type', label: 'Type'},
        {key: 'required', label: 'Required'},
        {key: 'label', label: 'Label'},
      ], flags)
    } catch (error) {
      this.fail(error)
    }
  }
}
