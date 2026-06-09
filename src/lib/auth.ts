import open from 'open'
import {CLIENT_ID} from './config.js'
import {getEntry, setEntry, deleteEntry} from './store.js'

export interface StoredToken {
  access_token: string
  refresh_token?: string
  expires_at?: number // epoch seconds
  scopes: string[]
  source?: 'env'
}

const REFRESH_GRANT = 'refresh_token'
const REFRESH_SKEW_SECONDS = 5 * 60

export async function readToken(host: string): Promise<StoredToken | null> {
  // Agent/headless override: PIMA_TOKEN bypasses the store entirely.
  if (process.env.PIMA_TOKEN) {
    return {access_token: process.env.PIMA_TOKEN, scopes: [], source: 'env'}
  }
  return getEntry<StoredToken>(host)
}

export async function readFreshToken(host: string): Promise<StoredToken | null> {
  const token = await readToken(host)
  if (!token || token.source === 'env' || !shouldRefresh(token)) return token
  if (!token.refresh_token) return token

  try {
    return await refreshStoredToken(host, token)
  } catch (error) {
    if (isExpired(token)) throw error
    return token
  }
}

export async function writeToken(host: string, token: StoredToken): Promise<void> {
  await setEntry(host, token)
}

export async function deleteToken(host: string): Promise<boolean> {
  return deleteEntry(host)
}

export async function refreshStoredToken(host: string, token: StoredToken): Promise<StoredToken> {
  if (token.source === 'env' || !token.refresh_token) {
    throw new Error('No refresh token is available. Run `pima auth login`.')
  }

  const res = await fetch(`${host}/oauth/token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: REFRESH_GRANT,
      refresh_token: token.refresh_token,
    }),
  })
  const body = (await safeJson(res)) as Record<string, any>

  if (!res.ok || !body.access_token) {
    throw new Error(`Session expired. Run \`pima auth login\`. ${body?.error_description ?? body?.error ?? ''}`.trim())
  }

  const refreshed = tokenFromResponse(body, token.scopes, token.refresh_token)
  await writeToken(host, refreshed)
  return refreshed
}

interface DeviceCode {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  interval: number
  expires_in: number
}

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

// gh-style device flow: request a code, show it, POLL the token endpoint until
// the user finishes in the browser. No localhost callback listener.
export async function deviceLogin(host: string, scopes: string[]): Promise<StoredToken> {
  const start = await fetch(`${host}/oauth/authorize_device`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams({client_id: CLIENT_ID, scope: scopes.join(' ')}),
  })
  if (!start.ok) throw new Error(`Device authorization failed (${start.status}): ${await start.text()}`)
  const device = (await start.json()) as DeviceCode

  process.stderr.write(`\n  First copy your one-time code: \x1b[1m${device.user_code}\x1b[0m\n`)
  process.stderr.write(`  Then open: ${device.verification_uri}\n\n`)
  try {
    await open(device.verification_uri_complete ?? device.verification_uri)
  } catch {
    /* headless / no browser — the user can open the URL manually */
  }

  const deadline = Date.now() + device.expires_in * 1000
  let interval = device.interval || 5

  while (Date.now() < deadline) {
    await sleep(interval * 1000)
    const res = await fetch(`${host}/oauth/token`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: device.device_code,
        grant_type: DEVICE_GRANT,
      }),
    })
    const body = (await res.json()) as Record<string, any>

    if (res.ok && body.access_token) {
      return tokenFromResponse(body, scopes)
    }

    switch (body.error) {
      case 'authorization_pending':
        break // keep polling
      case 'slow_down':
        interval += 5
        break
      case 'access_denied':
        throw new Error('Authorization was denied.')
      case 'expired_token':
        throw new Error('The device code expired. Run `pima auth login` again.')
      default:
        throw new Error(`Token error: ${body.error ?? res.status} ${body.error_description ?? ''}`)
    }
  }
  throw new Error('Timed out waiting for authorization.')
}

function tokenFromResponse(body: Record<string, any>, fallbackScopes: string[], fallbackRefreshToken?: string): StoredToken {
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token || fallbackRefreshToken,
    expires_at: body.expires_in ? Math.floor(Date.now() / 1000) + body.expires_in : undefined,
    scopes: (body.scope ?? fallbackScopes.join(' ')).split(' ').filter(Boolean),
  }
}

function shouldRefresh(token: StoredToken): boolean {
  return Boolean(token.expires_at && Math.floor(Date.now() / 1000) >= token.expires_at - REFRESH_SKEW_SECONDS)
}

function isExpired(token: StoredToken): boolean {
  return Boolean(token.expires_at && Math.floor(Date.now() / 1000) >= token.expires_at)
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {error: text}
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
