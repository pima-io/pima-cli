import {fetchManifest, findResource, type ManifestAction, type ManifestResource} from './manifest.js'

export type ResourceAccessVerb = 'read' | 'create' | 'update' | 'destroy'

export async function verifyResourceAccess(opts: {
  host?: string
  resource: string
  verb: ResourceAccessVerb
}): Promise<ManifestResource> {
  const manifest = await fetchManifest({host: opts.host})
  const resource = findResource(manifest, opts.resource)
  if (!resource) {
    const err: any = new Error(`Unknown or inaccessible resource: ${opts.resource}. Run \`pima resources\` to see your current access.`)
    err.exitCode = 4
    throw err
  }

  if (!resource.access?.[opts.verb]) {
    const err: any = new Error(
      `Forbidden — current token/role does not have ${opts.verb} access to ${resource.id}. Run \`pima resource describe ${resource.id}\` to inspect access.`,
    )
    err.exitCode = 3
    throw err
  }

  return resource
}

export async function verifyMemberActionAccess(opts: {
  host?: string
  resource: string
  action: string
  method?: string
}): Promise<{resource: ManifestResource; action: ManifestAction}> {
  const resource = await verifyResourceAccess({host: opts.host, resource: opts.resource, verb: 'read'})
  const action = (resource.member_actions ?? []).find((candidate) => candidate.name === opts.action)
  if (!action) {
    const err: any = new Error(
      `Forbidden or unknown action: ${resource.id}/${opts.action}. The live manifest does not expose this action for your current token/role.`,
    )
    err.exitCode = 3
    throw err
  }

  if (opts.method && !methodAllowed(action, opts.method)) {
    const err: any = new Error(`${resource.id}/${opts.action} allows ${action.method}, not ${opts.method.toUpperCase()}.`)
    err.exitCode = 5
    throw err
  }

  return {resource, action}
}

function methodAllowed(action: ManifestAction, method: string): boolean {
  const allowed = action.method
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
  return allowed.includes(method.toUpperCase())
}
