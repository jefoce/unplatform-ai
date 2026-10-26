import { errorResponse, type IdRouteContext, parseKinds } from '@/server/http'
import { listFolderFiles } from '@/server/repos/folders'
import { assertLocalRequest } from '@/server/request-guard'

export async function GET(request: Request, { params }: IdRouteContext) {
  try {
    assertLocalRequest(request)
    const { id } = await params
    const query = new URL(request.url).searchParams

    const result = await listFolderFiles({
      folderId: id,
      sub: query.get('sub') ?? undefined,
      kinds: parseKinds(query.get('kind')),
    })

    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
