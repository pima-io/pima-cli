import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {cancelAlteration} from '../src/lib/alterations.js'

describe('alterations', () => {
  it('posts the workflow cancellation endpoint and returns its response', async () => {
    const calls: string[] = []
    const client = {
      post: async (path: string) => {
        calls.push(path)
        return {
          alteration: {id: 74_902, order_item_id: 123, status: 'canceled'},
          notice: 'Alteration canceled.',
        }
      },
    }

    const response = await cancelAlteration(client, '74902')

    assert.deepEqual(calls, ['/alterations/74902/cancel.json'])
    assert.equal(response.alteration.status, 'canceled')
    assert.equal(response.notice, 'Alteration canceled.')
  })

  it('escapes the path id', async () => {
    let calledPath = ''
    const client = {
      post: async (path: string) => {
        calledPath = path
        return {alteration: {id: 1, order_item_id: 2, status: 'canceled'}, notice: 'Alteration canceled.'}
      },
    }

    await cancelAlteration(client, '1/2')

    assert.equal(calledPath, '/alterations/1%2F2/cancel.json')
  })
})
