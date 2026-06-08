import type {ManifestResource} from './manifest.js'
import {pathWithQuery, type ResourceQueryParams} from './params.js'

export interface ResourceLinkOptions extends ResourceQueryParams {
  action?: 'index' | 'show' | 'new' | 'edit'
  id?: string | number
  anchor?: string
}

export function absoluteAppUrl(host: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path

  const base = host.replace(/\/$/, '')
  const appPath = path.startsWith('/app') ? path : `/app${path.startsWith('/') ? path : `/${path}`}`
  return `${base}${appPath}`
}

export function resourceAppPath(resource: ManifestResource, opts: ResourceLinkOptions = {}): string {
  const action = opts.action ?? (opts.id ? 'show' : 'index')
  const base = basePath(resource, action, opts)
  const {action: _action, id: _id, anchor: _anchor, variant: _variant, ...query} = opts
  const path = pathWithQuery(base, query)
  return opts.anchor ? `${path}#${encodeURIComponent(opts.anchor).replace(/%2D/g, '-')}` : path
}

export function resourceAppUrl(host: string, resource: ManifestResource, opts: ResourceLinkOptions = {}): string {
  return absoluteAppUrl(host, resourceAppPath(resource, opts))
}

function basePath(resource: ManifestResource, action: ResourceLinkOptions['action'], opts: ResourceLinkOptions): string {
  switch (action) {
    case 'show':
      return fillId(requiredPath(resource.paths?.show, 'show', resource.id), opts.id)
    case 'new':
      return requiredPath(resource.paths?.new, 'new', resource.id)
    case 'edit':
      if (resource.paths?.edit) return fillId(resource.paths.edit, opts.id)
      return `${fillId(requiredPath(resource.paths?.show, 'show', resource.id), opts.id)}/edit`
    case 'index':
    default:
      return indexPath(resource, opts.variant)
  }
}

function indexPath(resource: ManifestResource, variant?: string): string {
  if (variant) {
    const view = (resource.views ?? []).find((candidate) => candidate.id === variant)
    if (view?.path) return view.path
    if (resource.paths?.index) return `${resource.paths.index.replace(/\/$/, '')}/${variant}`
  }

  return requiredPath(resource.paths?.index, 'index', resource.id)
}

function fillId(path: string, id: string | number | undefined): string {
  if (id === undefined || id === '') {
    const err: any = new Error('A record id is required for this link.')
    err.exitCode = 5
    throw err
  }
  const value = String(id) === '{id}' ? '{id}' : encodeURIComponent(String(id))
  return path.replace(/\{id\}/g, value)
}

function requiredPath(path: string | undefined, name: string, resource: string): string {
  if (path) return path

  const err: any = new Error(`${resource} does not expose a ${name} path in the manifest.`)
  err.exitCode = 4
  throw err
}
