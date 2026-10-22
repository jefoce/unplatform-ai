import { assertLocalRequest, errorResponse, parseKinds } from '@/server/http'
import { listFolderFiles } from '@/server/repos/folders'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: Params) {
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
