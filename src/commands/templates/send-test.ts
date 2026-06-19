import {readFile} from 'node:fs/promises'
import {Args, Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {normalizeProductIds, sendTemplateTestEmail} from '../../lib/templates.js'

// Friendly wrapper over the same test-send endpoint used by the React Liquid
// template editor. Requires the server-side template edit permission.
export default class TemplatesSendTest extends BaseCommand {
  static description = 'Send a Liquid template test email. Requires template edit access.'
  static examples = [
    '<%= config.bin %> templates send-test receipt --email preview@example.com --yes',
    '<%= config.bin %> templates send-test receipt --location 12 --product 101 --product 102 --email preview@example.com --yes',
    '<%= config.bin %> templates send-test receipt --content-file ./receipt.liquid --subject "Order {{code}} receipt" --email preview@example.com --yes',
  ]

  static args = {
    code: Args.string({required: true, description: 'Template code, e.g. receipt'}),
  }

  static flags = {
    email: Flags.string({required: true, description: 'Recipient email address'}),
    location: Flags.string({description: 'Location id for location-specific templates'}),
    product: Flags.string({
      multiple: true,
      description: 'Product id to include in the fake order (repeatable; comma-separated ids are accepted)',
    }),
    content: Flags.string({description: 'Template content override to test without saving'}),
    'content-file': Flags.string({description: 'Read template content override from a file'}),
    subject: Flags.string({description: 'Template subject override to test without saving'}),
    'dry-run': Flags.boolean({description: 'Print the request without sending email'}),
    yes: Flags.boolean({char: 'y', description: 'Skip the confirmation prompt'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(TemplatesSendTest)

    try {
      const content = await templateContent(flags.content, flags['content-file'])
      const body = {
        code: args.code,
        email: flags.email,
        location_id: flags.location,
        product_ids: normalizeProductIds(flags.product),
        content,
        subject: flags.subject,
      }

      if (flags['dry-run']) {
        this.log('DRY RUN → POST /templates/send_test.json')
        this.log(JSON.stringify({
          id: body.code,
          email: body.email,
          location_id: body.location_id,
          product_ids: body.product_ids,
          content: body.content,
          subject: body.subject,
        }, null, 2))
        return
      }

      if (!flags.yes) {
        this.log(`About to send a ${args.code} template test email to ${flags.email}. Re-run with --yes to confirm.`)
        return
      }

      const client = await this.client(flags.host)
      const data = await sendTemplateTestEmail(client, body)
      this.log(flags.json ? JSON.stringify(data, null, 2) : `✓ ${data.message}`)
    } catch (error) {
      this.fail(error)
    }
  }
}

async function templateContent(content?: string, contentFile?: string): Promise<string | undefined> {
  if (content && contentFile) {
    const error = new Error('Use either --content or --content-file, not both.')
    ;(error as Error & {exitCode?: number}).exitCode = 5
    throw error
  }

  if (!contentFile) return content
  return readFile(contentFile, 'utf8')
}
