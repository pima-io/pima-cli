import {homedir} from 'node:os'
import {join} from 'node:path'
import {mkdir, readFile, writeFile, chmod} from 'node:fs/promises'

// File-backed token store at ~/.config/pima/auth.json (mode 0600), keyed by
// host. Dependency-light and portable; an OS-keychain backend can be added
// later without changing callers.
const DIR = join(homedir(), '.config', 'pima')
const FILE = join(DIR, 'auth.json')

type Store = Record<string, unknown>

async function read(): Promise<Store> {
  try {
    return JSON.parse(await readFile(FILE, 'utf8')) as Store
  } catch {
    return {}
  }
}

async function write(store: Store): Promise<void> {
  await mkdir(DIR, {recursive: true, mode: 0o700})
  await writeFile(FILE, JSON.stringify(store, null, 2), {mode: 0o600})
  await chmod(FILE, 0o600).catch(() => {})
}

export async function getEntry<T>(host: string): Promise<T | null> {
  const store = await read()
  return (store[host] as T) ?? null
}

export async function setEntry(host: string, value: unknown): Promise<void> {
  const store = await read()
  store[host] = value
  await write(store)
}

export async function deleteEntry(host: string): Promise<boolean> {
  const store = await read()
  if (!(host in store)) return false
  delete store[host]
  await write(store)
  return true
}
