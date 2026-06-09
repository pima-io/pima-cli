import {spawn} from 'node:child_process'

export const DEFAULT_UPDATE_PACKAGE = '@pima-io/cli@latest'

export type UpdateCommand = {
  command: string
  args: string[]
  display: string
}

export type UpdateFailure = Error & {
  exitCode?: number
}

export function buildUpdateCommand(packageSpec = DEFAULT_UPDATE_PACKAGE): UpdateCommand {
  const command = 'npm'
  const args = ['install', '-g', packageSpec]
  return {command, args, display: formatCommand(command, args)}
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(shellQuote).join(' ')
}

export async function runUpdateCommand(updateCommand: UpdateCommand): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(updateCommand.command, updateCommand.args, {stdio: 'inherit'})

    child.on('error', (error) => reject(error))
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      const message = signal
        ? `Update command stopped with signal ${signal}.`
        : `Update command exited with status ${code ?? 1}.`
      const error = new Error(message) as UpdateFailure
      error.exitCode = typeof code === 'number' ? code : 1
      reject(error)
    })
  })
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_/:=@%+.,-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}
