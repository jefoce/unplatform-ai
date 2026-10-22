import type { UploadItem } from '@/core/types'
import { assertLocalRequest, errorResponse, jsonError, parseKinds } from '@/server/http'
import { listUploads, saveFileUpload } from '@/server/repos/uploads'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const query = new URL(request.url).searchParams
    const ids = (query.get('ids') ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    const items = await listUploads({ kinds: parseKinds(query.get('kind')), ids })

    return Response.json(items)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const form = await request.formData().catch(() => null)

    if (!form) return jsonError({ status: 400, error: 'Invalid form data' })

    const files = form.getAll('file').filter((value): value is File => value instanceof File)

    if (files.length === 0) return jsonError({ status: 400, error: 'No files provided' })

    const items: UploadItem[] = []

    for (const file of files) {
      items.push(
        await saveFileUpload({
          bytes: new Uint8Array(await file.arrayBuffer()),
          originalName: file.name === '' ? `pasted-${Date.now()}.png` : file.name,
        }),
      )
    }

    return Response.json(items, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
