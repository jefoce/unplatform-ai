import { isNonEmptyString } from '@/core/guards'
import { streamFile } from '@/server/fs/range-response'
import { errorResponse, jsonError, type KeyRouteContext } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { mockObjectPath, verifyMockSignature } from '@/server/storage/mock-store'

export const dynamic = 'force-dynamic'

async function serve(request: Request, { params }: KeyRouteContext): Promise<Response> {
  const { key } = await params

  return handle(request, key)
}

export { serve as GET, serve as HEAD }

/** Serves an object from the mock remote store, signed and short lived. */
async function handle(request: Request, keyParts: string[]): Promise<Response> {
  if ((process.env.REMOTE_MOCK?.trim() ?? '') === '') {
    return new Response('Not found', { status: 404 })
  }

  try {
    assertLocalRequest(request, { session: false })
    const key = keyParts.join('/')
    const url = new URL(request.url)
    const exp = Number(url.searchParams.get('exp'))
    const sig = url.searchParams.get('sig') ?? ''

    if (!verifyMockSignature({ key, exp, sig })) {
      return jsonError({ status: 403, error: 'Invalid or expired link' })
    }

    const file = mockObjectPath(key)

    if (!isNonEmptyString(file)) {
      return jsonError({ status: 404, error: 'Object not found' })
    }

    const response = await streamFile({
      absPath: file,
      request,
      opts: { cacheControl: 'private, max-age=0, must-revalidate' },
    })

    if (response.status === 404) {
      return jsonError({ status: 404, error: 'Object not found' })
    }

    return response
  } catch (error) {
    return errorResponse(error)
  }
}
