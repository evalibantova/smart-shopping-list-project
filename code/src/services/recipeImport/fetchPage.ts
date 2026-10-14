import { timedFetch } from './request'
import { ImportError, type FetchedPage, type ImportErrorCode } from './types'

const ENDPOINT = '/api/fetch-recipe.php'
const TIMEOUT_MS = 20_000
const SERVER_CODES: ImportErrorCode[] = ['bad_url', 'blocked_host', 'fetch_failed', 'too_large', 'no_content']

export function assertHttpUrl(url: string): void {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return
  } catch {
    // fall through
  }
  throw new ImportError('bad_url')
}

function isFetchedPage(body: unknown): body is FetchedPage {
  const b = body as Partial<FetchedPage> | null
  return !!b && (b.source === 'jsonld' || b.source === 'text') && typeof b.text === 'string'
}

function errorCodeFrom(body: unknown): ImportErrorCode {
  const code = (body as { error?: unknown } | null)?.error
  return SERVER_CODES.find((c) => c === code) ?? 'fetch_failed'
}

export async function fetchPage(
  url: string,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<FetchedPage> {
  assertHttpUrl(url)
  const res = await timedFetch(
    opts.fetchImpl ?? fetch,
    `${ENDPOINT}?url=${encodeURIComponent(url.trim())}`,
    {},
    TIMEOUT_MS,
    opts.signal,
  )

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) throw new ImportError(errorCodeFrom(body))
  if (!isFetchedPage(body)) throw new ImportError('fetch_failed')
  return body
}
