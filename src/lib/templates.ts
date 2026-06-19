import {Client} from './client.js'

export interface SendTemplateTestEmailParams {
  code: string
  email: string
  location_id?: string | number
  product_ids?: Array<string | number>
  content?: string
  subject?: string
}

export interface SendTemplateTestEmailResult {
  message: string
}

export async function sendTemplateTestEmail(
  client: Client,
  params: SendTemplateTestEmailParams,
): Promise<SendTemplateTestEmailResult> {
  return client.post('/templates/send_test.json', {
    id: params.code,
    email: params.email,
    location_id: params.location_id,
    product_ids: params.product_ids ?? [],
    content: params.content,
    subject: params.subject,
  })
}

export function normalizeProductIds(values: Array<string | number> = []): string[] {
  return values
    .flatMap((value) => value.toString().split(','))
    .map((value) => value.trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index)
}
