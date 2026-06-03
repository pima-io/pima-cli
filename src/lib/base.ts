import {Command, Flags} from '@oclif/core'
import {Client, ApiError} from './client.js'
import {renderList, renderRecord, type Column, type OutputFormat} from './output.js'

// Shared base for every command: global output flags, a client factory, output
// helpers that honor --json/--csv, and consistent error → exit-code mapping.
export abstract class BaseCommand extends Command {
  static baseFlags = {
    host: Flags.string({description: 'PIMA host URL', helpGroup: 'GLOBAL'}),
    json: Flags.boolean({description: 'Output raw lean JSON', helpGroup: 'GLOBAL'}),
    csv: Flags.boolean({description: 'Output CSV (lists/reports)', helpGroup: 'GLOBAL'}),
  }

  protected client(host?: string): Promise<Client> {
    return Client.create({host})
  }

  protected outputFormat(flags: {json?: boolean; csv?: boolean}): OutputFormat {
    return flags.json ? 'json' : flags.csv ? 'csv' : 'table'
  }

  protected printList(records: any[], columns: Column[], flags: {json?: boolean; csv?: boolean}): void {
    const fmt = this.outputFormat(flags)
    if (fmt === 'table' && records.length === 0) {
      this.log('No results.')
      return
    }
    this.log(renderList(records, columns, fmt))
  }

  protected printRecord(record: any, flags: {json?: boolean; csv?: boolean}): void {
    this.log(renderRecord(record, this.outputFormat(flags)))
  }

  // Detail/show payloads are { resource, record, ... }. JSON consumers get the
  // whole payload; the human view shows the flat record fields.
  protected printShow(data: any, flags: {json?: boolean}): void {
    if (flags.json) {
      this.log(JSON.stringify(data, null, 2))
      return
    }
    this.log(renderRecord(data?.record ?? data, 'table'))
  }

  // Map an API/transport error onto a stable exit code and a clean message.
  protected fail(error: unknown): never {
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401:
          this.error('Not authenticated. Run `pima auth login`.', {exit: 3})
          break
        case 403:
          this.error('Forbidden — your token lacks the required scope (or your PIMA role lacks the ability).', {exit: 3})
          break
        case 404:
          this.error('Not found.', {exit: 4})
          break
        case 422:
          this.error(validationMessage(error), {exit: 5})
          break
        default:
          this.error(error.message, {exit: 1})
      }
    }
    const e = error as {message?: string; exitCode?: number}
    this.error(e?.message ?? String(error), {exit: e?.exitCode ?? 1})
  }
}

function validationMessage(error: ApiError): string {
  const body = error.body
  if (body && typeof body === 'object') {
    if (Array.isArray(body.errors)) return body.errors.join('; ')
    if (body.errors) return JSON.stringify(body.errors)
    if (body.error) return String(body.error)
  }
  return 'Validation failed.'
}
