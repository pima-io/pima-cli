import {Client} from './client.js'

export type FeedbackKind = 'bug' | 'question' | 'feature'

export interface FeedbackPayload {
  kind: FeedbackKind
  title: string
  description?: string
  expected?: string
  actual?: string
  steps?: string
  severity?: string
  request_id?: string
  status?: string | number
  command?: string
  resource?: string
  record_id?: string
  path?: string
  method?: string
  url?: string
  error_class?: string
  error_message?: string
  context?: Record<string, unknown>
  codex_pr?: boolean
}

export interface FeedbackThreadMessage {
  id?: number | string
  role: 'user' | 'assistant' | 'system'
  body: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface FeedbackThread {
  id: number | string
  public_id?: string
  kind: 'question'
  status: 'queued' | 'running' | 'answered' | 'failed' | 'escalated' | string
  title: string
  latest_answer?: string | null
  error_message?: string | null
  codex_thread_id?: string | null
  created_at?: string
  updated_at?: string
  last_asked_at?: string
  answered_at?: string
  failed_at?: string
  messages?: FeedbackThreadMessage[]
}

export interface FeedbackResult {
  feedback: {
    kind: FeedbackKind
    github_issue?: {number?: number; url?: string; html_url?: string; title?: string}
    thread?: FeedbackThread
    codex: {should_start?: boolean; action: string; reason?: string; dispatch?: string; issue_url?: string; codex_session_url?: string; thread_id?: string}
  }
}

export interface FeedbackFlags {
  title: string
  description?: string
  expected?: string
  actual?: string
  steps?: string
  severity?: string
  'request-id'?: string
  status?: string
  command?: string
  resource?: string
  'record-id'?: string
  path?: string
  method?: string
  url?: string
  'error-class'?: string
  'error-message'?: string
  context?: string
  'codex-pr'?: 'auto' | 'yes' | 'no'
}

export function buildFeedbackPayload(kind: FeedbackKind, flags: FeedbackFlags): FeedbackPayload {
  const payload: FeedbackPayload = {
    kind,
    title: flags.title,
    description: flags.description,
    expected: flags.expected,
    actual: flags.actual,
    steps: flags.steps,
    severity: flags.severity,
    request_id: flags['request-id'],
    status: flags.status,
    command: flags.command,
    resource: flags.resource,
    record_id: flags['record-id'],
    path: flags.path,
    method: flags.method,
    url: flags.url,
    error_class: flags['error-class'],
    error_message: flags['error-message'],
    context: flags.context ? parseContext(flags.context) : undefined,
  }

  if (flags['codex-pr'] === 'yes') payload.codex_pr = true
  if (flags['codex-pr'] === 'no') payload.codex_pr = false

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined && value !== '')) as FeedbackPayload
}

export async function fileFeedback(client: Client, payload: FeedbackPayload): Promise<FeedbackResult> {
  return client.post('/api_feedback.json', {feedback: payload})
}

export async function getFeedback(client: Client, id: string): Promise<FeedbackResult> {
  return client.get(`/api_feedback/${encodeURIComponent(id)}.json`)
}

export async function followUpFeedback(client: Client, id: string, message: string, context?: Record<string, unknown>): Promise<FeedbackResult> {
  return client.post(`/api_feedback/${encodeURIComponent(id)}/messages.json`, {message, context})
}

export function renderFeedbackResult(result: FeedbackResult): string {
  const feedback = result.feedback
  if (feedback.thread) return renderFeedbackThread(feedback.thread)

  const issue = feedback.github_issue
  const codex = feedback.codex
  const lines = [`Filed ${feedback.kind} #${issue?.number ?? '?'}${issue?.html_url ? `: ${issue.html_url}` : ''}`]
  lines.push(`Codex: ${codex.action}${codex.dispatch ? ` (${codex.dispatch})` : ''}`)
  if (codex.codex_session_url) lines.push(`Codex session: ${codex.codex_session_url}`)
  return lines.join('\n')
}

export function renderFeedbackThread(thread: FeedbackThread): string {
  const label = thread.public_id ?? `q_${thread.id}`
  const lines = [`Question ${label} ${thread.status}.`]
  if (thread.latest_answer) lines.push('', 'Answer:', thread.latest_answer)
  if (thread.error_message) lines.push('', `Error: ${thread.error_message}`)
  return lines.join('\n')
}

export function parseFeedbackContext(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('--context must be a JSON object')
  return parsed as Record<string, unknown>
}

function parseContext(raw: string): Record<string, unknown> {
  return parseFeedbackContext(raw)
}
