import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeProductIds, sendTemplateTestEmail} from '../src/lib/templates.js'

describe('template helpers', () => {
  it('posts to the same template test-send endpoint used by the app editor', async () => {
    const calls: Array<{path: string; body: any}> = []
    const client = {
      post: async (path: string, body: any) => {
        calls.push({path, body})
        return {message: 'Sent test email to preview@example.com.'}
      },
    } as any

    const res = await sendTemplateTestEmail(client, {
      code: 'receipt',
      email: 'preview@example.com',
      location_id: 12,
      product_ids: ['101', '102'],
      content: '<p>{{ code }}</p>',
      subject: 'Receipt {{ code }}',
    })

    assert.equal(res.message, 'Sent test email to preview@example.com.')
    assert.equal(calls[0].path, '/templates/send_test.json')
    assert.deepEqual(calls[0].body, {
      id: 'receipt',
      email: 'preview@example.com',
      location_id: 12,
      product_ids: ['101', '102'],
      content: '<p>{{ code }}</p>',
      subject: 'Receipt {{ code }}',
    })
  })

  it('normalizes repeatable and comma-separated product ids', () => {
    assert.deepEqual(normalizeProductIds(['101, 102', '103', '102', '', ' 104 ']), ['101', '102', '103', '104'])
  })
})
