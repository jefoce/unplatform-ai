import type { UploadItem } from '@/core/schemas/upload-item'
import { errorResponse, jsonError, parseKinds } from '@/server/http'
import { listUploads } from '@/server/repos/uploads'
import { assertLocalRequest } from '@/server/request-guard'
import { createFileUpload } from '@/server/services/uploads'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const query = new URL(request.url).searchParams

    const ids = (query.get('ids') ?? '')
      .split(',')
      .map((part) => {
        return part.trim()
      })
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

    const form = await request.formData().catch(() => {
      return null
    })

    if (!form) {
      return jsonError({ status: 400, error: 'Invalid form data' })
    }

    const files = form.getAll('file').filter((value): value is File => {
      return value instanceof File
    })

    if (files.length === 0) {
      return jsonError({ status: 400, error: 'No files provided' })
    }

    const items: UploadItem[] = []

    for (const file of files) {
      const originalName = file.name === '' ? `pasted-${Date.now()}.png` : file.name

      items.push(
        await createFileUpload({
          bytes: new Uint8Array(await file.arrayBuffer()),
          originalName,
        }),
      )
    }

    return Response.json(items, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
