import {Command, Flags} from '@oclif/core'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {buildServer} from '../mcp/server.js'
import {resolveHost} from '../lib/config.js'

// Runs an MCP server over stdio so agents (Claude/Codex) can drive PIMA
// conversationally. Reuses the connected token's scopes. Read-only unless
// --write. NOTE: stdout is reserved for the MCP protocol — status goes to stderr.
export default class Mcp extends Command {
  static description = 'Run an MCP server exposing PIMA over stdio for agents (read-only unless --write).'

  static examples = [
    '<%= config.bin %> mcp',
    '<%= config.bin %> mcp --write --host https://pima.io',
  ]

  static flags = {
    host: Flags.string({description: 'PIMA host URL'}),
    write: Flags.boolean({description: 'Also expose write tools (still bounded by your token scopes)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Mcp)
    const host = await resolveHost(flags.host)
    const server = buildServer({host, write: flags.write})
    await server.connect(new StdioServerTransport())
    process.stderr.write(`pima mcp: connected (host=${host}, write=${flags.write ? 'on' : 'off'})\n`)
  }
}
