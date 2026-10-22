import { browseDirectories } from '@/server/fs/browse'
import { assertLocalRequest, errorResponse } from '@/server/http'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const query = new URL(request.url).searchParams
    const result = await browseDirectories({
      path: query.get('path')?.trim(),
      hidden: query.get('hidden') === '1',
    })

    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
