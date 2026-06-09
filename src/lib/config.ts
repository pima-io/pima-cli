import {homedir} from 'node:os'
import {join} from 'node:path'
import {mkdir, readFile, writeFile} from 'node:fs/promises'

// Public OAuth client id for the CLI. This is a *public* client (device flow,
// no secret), so shipping the id is fine. Override per-instance if needed.
export const CLIENT_ID = process.env.PIMA_CLIENT_ID ?? 'pima-cli'

export interface PimaConfig {
  host: string
  defaultLocationId?: number
}

const CONFIG_DIR = join(homedir(), '.config', 'pima')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

const DEFAULTS: PimaConfig = {
  host: 'https://pima.io',
}

export async function loadConfig(): Promise<PimaConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    return {...DEFAULTS, ...JSON.parse(raw)}
  } catch {
    return {...DEFAULTS}
  }
}

export async function saveConfig(patch: Partial<PimaConfig>): Promise<PimaConfig> {
  const next = {...(await loadConfig()), ...patch}
  await mkdir(CONFIG_DIR, {recursive: true})
  await writeFile(CONFIG_PATH, JSON.stringify(next, null, 2))
  return next
}

// Host resolution order: --host flag > PIMA_HOST env > config file > production default.
export async function resolveHost(flagHost?: string): Promise<string> {
  if (flagHost) return flagHost.replace(/\/$/, '')
  if (process.env.PIMA_HOST) return process.env.PIMA_HOST.replace(/\/$/, '')
  return (await loadConfig()).host.replace(/\/$/, '')
}
