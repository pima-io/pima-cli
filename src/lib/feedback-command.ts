import {Flags} from '@oclif/core'
import {BaseCommand} from './base.js'
import {
  buildFeedbackPayload,
  fileFeedback,
  followUpFeedback,
  getFeedback,
  parseFeedbackContext,
  renderFeedbackResult,
  type FeedbackKind,
  type FeedbackResult,
} from './feedback.js'

export const feedbackFlags = {
  title: Flags.string({required: true, description: 'Short issue title'}),
  description: Flags.string({description: 'Markdown description'}),
  expected: Flags.string({description: 'Expected behavior'}),
  actual: Flags.string({description: 'Actual behavior'}),
  steps: Flags.string({description: 'Steps to reproduce'}),
  severity: Flags.string({description: 'Severity label, e.g. low, medium, high'}),
  'request-id': Flags.string({description: 'PIMA request id, especially for 500s'}),
  status: Flags.string({description: 'HTTP status or app status'}),
  command: Flags.string({description: 'CLI command that produced the issue'}),
  resource: Flags.string({description: 'Related PIMA resource, e.g. orders'}),
  'record-id': Flags.string({description: 'Related record id'}),
  path: Flags.string({description: 'Related PIMA path or API path'}),
  method: Flags.string({description: 'Related HTTP method'}),
  url: Flags.string({description: 'Related PIMA URL'}),
  'error-class': Flags.string({description: 'Error class/name'}),
  'error-message': Flags.string({description: 'Sanitized error message'}),
  context: Flags.string({description: 'Additional sanitized JSON object'}),
  'codex-pr': Flags.string({options: ['auto', 'yes', 'no'], default: 'auto', description: 'Whether to request Codex PR automation'}),
  'dry-run': Flags.boolean({description: 'Print the feedback payload without creating a GitHub issue'}),
  yes: Flags.boolean({char: 'y', description: 'Create the GitHub issue without another confirmation'}),
}

export const questionFlags = {
  title: Flags.string({required: true, description: 'Short question title'}),
  description: Flags.string({description: 'Question details'}),
  'request-id': Flags.string({description: 'PIMA request id, especially for server errors'}),
  status: Flags.string({description: 'HTTP status or app status'}),
  command: Flags.string({description: 'CLI command related to the question'}),
  resource: Flags.string({description: 'Related PIMA resource, e.g. orders'}),
  'record-id': Flags.string({description: 'Related record id'}),
  path: Flags.string({description: 'Related PIMA path or API path'}),
  method: Flags.string({description: 'Related HTTP method'}),
  url: Flags.string({description: 'Related PIMA URL'}),
  'error-class': Flags.string({description: 'Error class/name'}),
  'error-message': Flags.string({description: 'Sanitized error message'}),
  context: Flags.string({description: 'Additional sanitized JSON object'}),
  wait: Flags.boolean({allowNo: true, default: true, description: 'Poll until the async answer is ready'}),
  timeout: Flags.integer({default: 180, description: 'Polling timeout in seconds'}),
  interval: Flags.integer({default: 2, description: 'Polling interval in seconds'}),
  'dry-run': Flags.boolean({description: 'Print the feedback payload without asking the question'}),
}

export const waitFlags = {
  wait: Flags.boolean({allowNo: true, default: false, description: 'Poll until the async answer is ready'}),
  timeout: Flags.integer({default: 180, description: 'Polling timeout in seconds'}),
  interval: Flags.integer({default: 2, description: 'Polling interval in seconds'}),
}

export async function runFeedbackCommand(command: BaseCommand, kind: FeedbackKind, flags: any): Promise<void> {
  const payload = buildFeedbackPayload(kind, flags)

  if (flags['dry-run']) {
    command.log('DRY RUN -> POST /api_feedback.json')
    command.log(JSON.stringify({feedback: payload}, null, 2))
    return
  }

  if (!flags.yes) {
    command.log(`About to file a ${kind} report in GitHub. Re-run with --yes to confirm (or --dry-run to preview).`)
    return
  }

  const result = await fileFeedback(await (command as any).client(flags.host), payload)
  command.log(flags.json ? JSON.stringify(result, null, 2) : renderFeedbackResult(result))
}

export async function runQuestionCommand(command: BaseCommand, flags: any): Promise<void> {
  const payload = buildFeedbackPayload('question', flags)

  if (flags['dry-run']) {
    command.log('DRY RUN -> POST /api_feedback.json')
    command.log(JSON.stringify({feedback: payload}, null, 2))
    return
  }

  const client = await (command as any).client(flags.host)
  const started = await fileFeedback(client, payload)
  const result = flags.wait
    ? await pollFeedback(() => getFeedback(client, questionId(started)), started, flags.interval * 1000, flags.timeout * 1000)
    : started
  command.log(flags.json ? JSON.stringify(result, null, 2) : renderFeedbackResult(result))
}

export async function runFeedbackStatusCommand(command: BaseCommand, id: string, flags: any): Promise<void> {
  const client = await (command as any).client(flags.host)
  const loaded = await getFeedback(client, id)
  const result = flags.wait
    ? await pollFeedback(() => getFeedback(client, id), loaded, flags.interval * 1000, flags.timeout * 1000)
    : loaded
  command.log(flags.json ? JSON.stringify(result, null, 2) : renderFeedbackResult(result))
}

export async function runFeedbackFollowUpCommand(command: BaseCommand, id: string, flags: any): Promise<void> {
  const context = flags.context ? parseFeedbackContext(flags.context) : undefined

  if (flags['dry-run']) {
    command.log(`DRY RUN -> POST /api_feedback/${id}/messages.json`)
    command.log(JSON.stringify({message: flags.message, context}, null, 2))
    return
  }

  const client = await (command as any).client(flags.host)
  const queued = await followUpFeedback(client, id, flags.message, context)
  const result = flags.wait
    ? await pollFeedback(() => getFeedback(client, id), queued, flags.interval * 1000, flags.timeout * 1000)
    : queued
  command.log(flags.json ? JSON.stringify(result, null, 2) : renderFeedbackResult(result))
}

async function pollFeedback(
  load: () => Promise<FeedbackResult>,
  initial: FeedbackResult,
  intervalMs: number,
  timeoutMs: number,
): Promise<FeedbackResult> {
  let current = initial
  const deadline = Date.now() + timeoutMs

  while (!terminal(current) && Date.now() < deadline) {
    await sleep(intervalMs)
    current = await load()
  }

  const thread = current.feedback.thread
  if (thread?.status === 'failed') {
    const err: any = new Error(thread.error_message || `Question ${thread.public_id ?? thread.id} failed.`)
    err.exitCode = 1
    throw err
  }

  return current
}

function terminal(result: FeedbackResult): boolean {
  const status = result.feedback.thread?.status
  return status === 'answered' || status === 'failed' || status === 'escalated'
}

function questionId(result: FeedbackResult): string {
  const thread = result.feedback.thread
  if (!thread) throw new Error('PIMA did not return a question thread id.')
  return thread.public_id ?? String(thread.id)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
