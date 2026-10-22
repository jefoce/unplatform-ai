import { isNil } from 'lodash-es'
import { z } from 'zod'

import { HISTORY_MAX_PAGE_SIZE, HISTORY_PAGE_SIZE, MAX_IDS } from '@/core/constants'
import { applyFilters, countActive, paginate, sortRecords } from '@/core/history-filters'
import { ASPECT_RATIOS, findPreset, RESOLUTIONS } from '@/core/presets'
import { buildInputSchema } from '@/core/validation'
import { assertLocalRequest, errorResponse, jsonError, readJsonBody, zodError } from '@/server/http'
import { createGeneration } from '@/server/jobs/create-generation'
import { listGenerations } from '@/server/repos/generations'
import { secretsReady } from '@/server/secrets'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(HISTORY_MAX_PAGE_SIZE).catch(HISTORY_PAGE_SIZE),
  favorite: z.enum(['1', 'true']).optional(),
  status: z.enum(['all', 'done', 'active', 'failed']).catch('all'),
  tab: z.enum(['frames', 'references', 'all']).catch('all'),
  mode: z.enum(['text', 'frames', 'references', 'all']).catch('all'),
  resolution: z.enum([...RESOLUTIONS, 'all']).optional(),
  aspect: z.enum([...ASPECT_RATIOS, 'auto', 'all']).optional(),
  audio: z.enum(['any', 'on', 'off']).catch('any'),
  q: z.string().optional(),
  model: z.string().optional(),
  ids: z.string().optional(),
})

const PresetIdSchema = z.object({ presetId: z.string() }).loose()

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const body = Object.fromEntries(new URL(request.url).searchParams)
    const query = QuerySchema.safeParse(body)

    if (!query.success) return zodError(query.error)

    const records = await listGenerations()
    const ids = (query.data.ids ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (ids.length > MAX_IDS)
      return jsonError({ status: 400, error: `Too many ids (max ${MAX_IDS})` })

    if (ids.length > 0) {
      const wanted = new Set(ids)

      return Response.json({
        items: sortRecords(records.filter((record) => wanted.has(record.id))),
        nextCursor: null,
        activeCount: countActive(records),
      })
    }

    const filtered = sortRecords(
      applyFilters(records, {
        q: query.data.q,
        model: query.data.model,
        favorite: isNil(query.data.favorite) ? undefined : true,
        status: query.data.status,
        tab: query.data.tab,
        mode: query.data.mode,
        resolution: query.data.resolution,
        aspect: query.data.aspect,
        audio: query.data.audio,
      }),
    )
    const page = paginate({
      records: filtered,
      cursor: query.data.cursor ?? null,
      limit: query.data.limit,
    })

    return Response.json({
      items: page.items,
      nextCursor: page.nextCursor,
      activeCount: countActive(records),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = await readJsonBody(request)
    const presetId = PresetIdSchema.safeParse(body)

    if (!presetId.success) return zodError(presetId.error)

    const preset = findPreset(presetId.data.presetId)

    if (!preset) return jsonError({ status: 400, error: 'Unknown model' })

    const input = buildInputSchema(preset).safeParse(body)

    if (!input.success) return zodError(input.error)

    await secretsReady()

    return Response.json(await createGeneration(input.data), { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
