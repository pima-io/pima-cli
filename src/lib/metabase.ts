import {spawn} from 'node:child_process'
import type {Client} from './client.js'

export interface MetabaseCliKey {
  url: string
  profile: string
  key_id?: number
  key_name?: string
  group_id?: number
  api_key: string
}

export interface MetabaseCliKeyResponse {
  metabase: MetabaseCliKey
  metabase_user?: {
    id: number | string
    email: string
  }
}

export interface MbLoginOptions {
  profile?: string
  disableKeyring?: boolean
  command?: string
  runner?: typeof runMbAuthLogin
  installer?: typeof installMetabaseCli
  autoInstall?: boolean
  onInstallStart?: () => void
}

export async function requestMetabaseCliKey(client: Client): Promise<{key: MetabaseCliKey; user?: MetabaseCliKeyResponse['metabase_user']}> {
  const response = await client.post<MetabaseCliKeyResponse>('/api_metabase/cli_key.json')
  if (!response?.metabase?.api_key || !response.metabase.url) {
    throw new Error('PIMA did not return a usable Metabase API key.')
  }

  return {key: response.metabase, user: response.metabase_user}
}

export async function loginMetabaseCli(key: MetabaseCliKey, opts: MbLoginOptions = {}): Promise<void> {
  const profile = opts.profile ?? key.profile
  const command = opts.command ?? 'mb'
  const runner = opts.runner ?? runMbAuthLogin
  const installer = opts.installer ?? installMetabaseCli
  const authOpts = {
    command,
    profile,
    url: key.url,
    apiKey: key.api_key,
    disableKeyring: opts.disableKeyring ?? true,
  }

  try {
    await runner(authOpts)
  } catch (error) {
    if (!(error instanceof MetabaseCliMissingError) || command !== 'mb' || opts.autoInstall === false) throw error

    opts.onInstallStart?.()
    await installer()
    await runner(authOpts)
  }
}

interface RunMbAuthLoginOptions {
  command: string
  profile: string
  url: string
  apiKey: string
  disableKeyring: boolean
}

export class MetabaseCliMissingError extends Error {
  constructor() {
    super('Metabase CLI `mb` was not found.')
  }
}

export function runMbAuthLogin(opts: RunMbAuthLoginOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      error ? reject(error) : resolve()
    }

    const child = spawn(opts.command, ['auth', 'login', '--profile', opts.profile, '--url', opts.url], {
      env: {
        ...process.env,
        ...(opts.disableKeyring ? {METABASE_CLI_DISABLE_KEYRING: '1'} : {}),
      },
      stdio: ['pipe', 'inherit', 'pipe'],
    })

    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        finish(new MetabaseCliMissingError())
      } else {
        finish(error)
      }
    })
    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(`Metabase CLI auth failed.${stderr ? ` ${stderr.trim()}` : ''}`))
    })

    child.stdin?.end(opts.apiKey)
  })
}

export function installMetabaseCli(): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      error ? reject(error) : resolve()
    }

    const child = spawn('npm', ['install', '-g', '@metabase/cli'], {
      stdio: 'inherit',
    })

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        finish(new Error('npm was not found. Install Node/npm, then rerun `pima metabase login`.'))
      } else {
        finish(error)
      }
    })
    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error('Failed to install @metabase/cli with npm.'))
    })
  })
}
