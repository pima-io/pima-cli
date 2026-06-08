import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {buildFeedbackPayload, fileFeedback, followUpFeedback, getFeedback, renderFeedbackResult} from '../src/lib/feedback.js'

describe('feedback helpers', () => {
  it('builds feedback payloads with context and codex override', () => {
    const payload = buildFeedbackPayload('bug', {
      title: 'Order export returns 500',
      description: 'Exporting shippable orders failed.',
      'request-id': 'req_123',
      status: '500',
      command: 'pima resource export orders',
      context: '{"resource":"orders","safe":true}',
      'codex-pr': 'no',
    })

    assert.deepEqual(payload, {
      kind: 'bug',
      title: 'Order export returns 500',
      description: 'Exporting shippable orders failed.',
      request_id: 'req_123',
      status: '500',
      command: 'pima resource export orders',
      context: {resource: 'orders', safe: true},
      codex_pr: false,
    })
  })

  it('posts feedback to the API endpoint', async () => {
    const calls: Array<{path: string; body: unknown}> = []
    const client = {
      post: async (path: string, body: unknown) => {
        calls.push({path, body})
        return {feedback: {kind: 'feature', github_issue: {number: 44}, codex: {should_start: true, action: 'create_pr'}}}
      },
    } as any

    const result = await fileFeedback(client, {kind: 'feature', title: 'Saved filters'})

    assert.equal(calls[0].path, '/api_feedback.json')
    assert.deepEqual(calls[0].body, {feedback: {kind: 'feature', title: 'Saved filters'}})
    assert.equal(result.feedback.github_issue.number, 44)
  })

  it('loads feedback question status and posts follow-ups', async () => {
    const calls: Array<{method: string; path: string; body?: unknown}> = []
    const client = {
      get: async (path: string) => {
        calls.push({method: 'GET', path})
        return {feedback: {kind: 'question', thread: {id: 12, public_id: 'q_12', status: 'answered', title: 'Where?'}, codex: {action: 'answer_async'}}}
      },
      post: async (path: string, body: unknown) => {
        calls.push({method: 'POST', path, body})
        return {feedback: {kind: 'question', thread: {id: 12, public_id: 'q_12', status: 'queued', title: 'Where?'}, codex: {action: 'answer_async'}}}
      },
    } as any

    await getFeedback(client, 'q_12')
    await followUpFeedback(client, 'q_12', 'What endpoint?', {resource: 'transfer_boxes'})

    assert.deepEqual(calls, [
      {method: 'GET', path: '/api_feedback/q_12.json'},
      {method: 'POST', path: '/api_feedback/q_12/messages.json', body: {message: 'What endpoint?', context: {resource: 'transfer_boxes'}}},
    ])
  })

  it('renders filed issue and codex status for humans', () => {
    assert.equal(
      renderFeedbackResult({
        feedback: {
          kind: 'bug',
          github_issue: {number: 12, html_url: 'https://github.test/issues/12'},
          codex: {should_start: true, action: 'create_pr', dispatch: 'started', codex_session_url: 'https://codex.test/s/1'},
        },
      }),
      'Filed bug #12: https://github.test/issues/12\nCodex: create_pr (started)\nCodex session: https://codex.test/s/1',
    )
  })

  it('renders async question answers for humans', () => {
    assert.equal(
      renderFeedbackResult({
        feedback: {
          kind: 'question',
          thread: {
            id: 12,
            public_id: 'q_12',
            kind: 'question',
            status: 'answered',
            title: 'Where is transfer damage state?',
            latest_answer: 'Transfer damage state is exposed through transfer boxes.',
          },
          codex: {action: 'answer_async', dispatch: 'answered'},
        },
      }),
      'Question q_12 answered.\n\nAnswer:\nTransfer damage state is exposed through transfer boxes.',
    )
  })
})
