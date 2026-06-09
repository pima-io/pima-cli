import {readFreshToken, refreshStoredToken, type StoredToken} from './auth.js'
import {resolveHost} from './config.js'

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(typeof body === 'string' ? body : (body?.message ?? body?.error ?? `HTTP ${status}`))
  }
}

export interface ClientOptions {
  host?: string
}

// Thin HTTP client over the existing react_ui JSON endpoints. Always sends
// `X-Pima-View: lean` so the shared serializer strips UI-only fields.
export class Client {
  private constructor(
    public readonly host: string,
    private token: StoredToken,
  ) {}

  static async create(opts: ClientOptions = {}): Promise<Client> {
    const host = await resolveHost(opts.host)
    const token = await readFreshToken(host)
    if (!token) {
      const err: any = new Error(`Not authenticated to ${host}. Run \`pima auth login\`.`)
      err.exitCode = 3
      throw err
    }
    return new Client(host, token)
  }

  async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    return this.requestWithRetry<T>(method, path, body, true)
  }

  private async requestWithRetry<T>(method: string, path: string, body: unknown, allowRefreshRetry: boolean): Promise<T> {
    const res = await fetch(`${this.host}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token.access_token}`,
        Accept: 'application/json',
        'X-Pima-View': 'lean',
        ...(body ? {'Content-Type': 'application/json'} : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const text = await res.text()
    const parsed = text ? safeJson(text) : null

    if (res.status === 401 && allowRefreshRetry && this.token.refresh_token && this.token.source !== 'env') {
      this.token = await refreshStoredToken(this.host, this.token)
      return this.requestWithRetry<T>(method, path, body, false)
    }

    if (!res.ok) throw new ApiError(res.status, parsed ?? text)
    return parsed as T
  }

  get<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  patch<T = any>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  post<T = any>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
