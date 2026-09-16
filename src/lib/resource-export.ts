import {createWriteStream} from 'node:fs'
import {unlink} from 'node:fs/promises'
import {resolve} from 'node:path'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import type {ResourceExport} from './resource.js'

export async function waitForExport(
  load: () => Promise<{export: ResourceExport}>,
  initial: ResourceExport,
  intervalMs: number,
  timeoutMs: number,
): Promise<{export: ResourceExport}> {
  let current = initial
  const deadline = Date.now() + timeoutMs
  while (!['completed', 'failed'].includes(current.status) && Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, intervalMs))
    current = (await load()).export
  }
  if (current.status === 'failed') throw new Error(current.error_message || `Export ${current.id} failed.`)
  return {export: current}
}

// Signed download URLs are fetched without sending PIMA's bearer token.
export async function downloadExport(exportData: ResourceExport, outputPath: string): Promise<string> {
  try {
    return await downloadExportFile(exportData, outputPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message} Check export #${exportData.id} with pima resource export-status ${exportData.id}; add --output <file> to retry the download.`, {cause: error})
  }
}

async function downloadExportFile(exportData: ResourceExport, outputPath: string): Promise<string> {
  if (exportData.status !== 'completed' || !exportData.file_url) throw new Error(`Export #${exportData.id} is not complete. No file was downloaded.`)
  const url = new URL(exportData.file_url)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Export download must use HTTPS.')
  if (url.username || url.password) throw new Error('Export URL must not contain credentials.')
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`Export download failed: HTTP ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/html')) {
    await response.body.cancel()
    throw new Error('Download returned an HTML page instead of an export.')
  }
  if (outputPath.toLowerCase().endsWith('.csv') && (url.pathname.endsWith('.zip') || contentType.includes('zip'))) {
    await response.body.cancel()
    throw new Error('This export is a ZIP archive. Use a .zip output path, or select a CSV export preset.')
  }
  const path = resolve(outputPath)
  const stream = createWriteStream(path, {flags: 'wx', mode: 0o600})
  let created = false
  stream.once('open', () => { created = true })
  try {
    await pipeline(Readable.fromWeb(response.body as any), stream)
  } catch (error) {
    if (created) await unlink(path).catch(() => undefined)
    throw error
  }
  return path
}
