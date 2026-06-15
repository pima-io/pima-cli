import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {MetabaseCliMissingError, loginMetabaseCli, requestMetabaseCliKey} from '../src/lib/metabase.js'

describe('metabase helpers', () => {
  it('requests a Metabase CLI key from PIMA', async () => {
    const calls: Array<{path: string; body?: unknown}> = []
    const client = {
      post: async (path: string, body?: unknown) => {
        calls.push({path, body})
        return {
          metabase: {
            url: 'https://metabase.example.test',
            profile: 'pima-test',
            key_id: 44,
            key_name: 'PIMA CLI - user@example.com',
            group_id: 12,
            api_key: 'mb_secret',
          },
          metabase_user: {
            id: 88,
            email: 'user@example.com',
          },
        }
      },
    } as any

    const result = await requestMetabaseCliKey(client)

    assert.deepEqual(calls, [{path: '/api_metabase/cli_key.json', body: undefined}])
    assert.equal(result.user?.id, 88)
    assert.equal(result.key.profile, 'pima-test')
    assert.equal(result.key.api_key, 'mb_secret')
  })

  it('pipes the API key into mb auth login without exposing it as an argv value', async () => {
    const calls: any[] = []

    await loginMetabaseCli(
      {
        url: 'https://metabase.example.test',
        profile: 'pima-test',
        api_key: 'mb_secret',
      },
      {
        command: 'mb',
        runner: async (opts) => {
          calls.push(opts)
        },
      },
    )

    assert.deepEqual(calls, [
      {
        command: 'mb',
        profile: 'pima-test',
        url: 'https://metabase.example.test',
        apiKey: 'mb_secret',
        disableKeyring: true,
      },
    ])
  })

  it('installs the official CLI and retries when the default mb command is missing', async () => {
    const authCalls: any[] = []
    const installCalls: string[] = []
    const installMessages: string[] = []

    await loginMetabaseCli(
      {
        url: 'https://metabase.example.test',
        profile: 'pima-test',
        api_key: 'mb_secret',
      },
      {
        runner: async (opts) => {
          authCalls.push(opts)
          if (authCalls.length === 1) throw new MetabaseCliMissingError()
        },
        installer: async () => {
          installCalls.push('install')
        },
        onInstallStart: () => {
          installMessages.push('installing')
        },
      },
    )

    assert.equal(authCalls.length, 2)
    assert.deepEqual(installCalls, ['install'])
    assert.deepEqual(installMessages, ['installing'])
  })

  it('does not auto-install for a custom mb command', async () => {
    const installCalls: string[] = []

    await assert.rejects(
      loginMetabaseCli(
        {
          url: 'https://metabase.example.test',
          profile: 'pima-test',
          api_key: 'mb_secret',
        },
        {
          command: '/custom/mb',
          runner: async () => {
            throw new MetabaseCliMissingError()
          },
          installer: async () => {
            installCalls.push('install')
          },
        },
      ),
      /Metabase CLI `mb` was not found/,
    )

    assert.deepEqual(installCalls, [])
  })
})
