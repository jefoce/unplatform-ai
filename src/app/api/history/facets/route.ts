import { z } from 'zod'

import { HISTORY_FACET_KINDS } from '@/core/history-facets'
import { errorResponse, jsonResponse, zodError } from '@/server/http'
import { assertLocalRequest } from '@/server/request-guard'
import { getHistoryFacets } from '@/server/services/history-facets'

export const dynamic = 'force-dynamic'

const HistoryFacetsQuerySchema = z.object({
  kind: z.enum(HISTORY_FACET_KINDS),
})

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)

    const query = HistoryFacetsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    )

    if (!query.success) {
      return zodError(query.error)
    }

    return jsonResponse(await getHistoryFacets(query.data.kind))
  } catch (error) {
    return errorResponse(error)
  }
}
