import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {buildUpdateCommand, DEFAULT_UPDATE_PACKAGE, formatCommand} from '../src/lib/update.js'

describe('update command helpers', () => {
  it('builds the default npm global install command', () => {
    const command = buildUpdateCommand()

    assert.equal(command.command, 'npm')
    assert.deepEqual(command.args, ['install', '-g', DEFAULT_UPDATE_PACKAGE])
    assert.equal(command.display, 'npm install -g @pima-io/cli@latest')
  })

  it('allows an alternate npm package spec', () => {
    const command = buildUpdateCommand('@pima-io/cli@next')

    assert.deepEqual(command.args, ['install', '-g', '@pima-io/cli@next'])
    assert.equal(command.display, 'npm install -g @pima-io/cli@next')
  })

  it('quotes display-only command parts with shell-sensitive characters', () => {
    assert.equal(
      formatCommand('npm', ['install', '-g', '@pima-io/cli@0.5.0-beta.1', '--tag', "agent's test"]),
      "npm install -g @pima-io/cli@0.5.0-beta.1 --tag 'agent'\\''s test'",
    )
  })
})
