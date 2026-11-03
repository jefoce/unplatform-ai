import { isNonEmptyString } from '@/core/guards'

/** Redirects an alias host page request to 127.0.0.1 at the same port and path. */
export function GET(request: Request): Response {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') ?? ''
  const port = url.port

  if (!isNonEmptyString(path) || !path.startsWith('/') || !isNonEmptyString(port)) {
    return new Response('Bad request', { status: 400 })
  }

  return new Response(null, {
    status: 308,
    headers: { Location: `http://127.0.0.1:${port}${path}` },
  })
}
