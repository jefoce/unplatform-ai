import { isNil } from 'lodash-es'

import { ImageListQuerySchema, ImageSubmitSchema } from '@/core/api/image'
import { IMAGE_MAX_ACTIVE, MAX_IDS } from '@/core/constants'
import { paginate, sortRecords } from '@/core/feed/history-filters'
import { isNonEmptyString } from '@/core/guards'
import { primaryBinding } from '@/core/presets/common/bindings'
import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { issueText } from '@/core/validation/common'
import { validateImageInput } from '@/core/validation/image'
import { isMockMode } from '@/server/config/mock-mode'
import { errorResponse, jsonError, jsonResponse, zodError } from '@/server/http'
import { listImages } from '@/server/repos/images'
import { assertLocalRequest, readJsonBody } from '@/server/request-guard'
import { getSecret, secretsReady } from '@/server/secrets'
import { loadCatalogEntry } from '@/server/services/estimate-generation'
import { createImage, priceImage } from '@/server/services/image-create'
import { findImagePresetAny } from '@/server/services/model-catalog'
import { withLock } from '@/server/sync/lock'

export const dynamic = 'force-dynamic'

function isFavorite(record: ImageRecord): boolean {
  return record.outputs.some((output) => {
    return output.status === 'saved' && output.favorite
  })
}

function matchesQuery(record: ImageRecord, query: string): boolean {
  const text = query.trim().toLowerCase()

  if (text === '') {
    return true
  }

  return `${record.input.prompt} ${record.preset.title}`.toLowerCase().includes(text)
}

function idsOf(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => {
      return part.trim()
    })
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    assertLocalRequest(request)
    const body = Object.fromEntries(new URL(request.url).searchParams)
    const query = ImageListQuerySchema.safeParse(body)

    if (!query.success) {
      return zodError(query.error)
    }

    const records = await listImages()
    const ids = idsOf(query.data.ids)
    const activeCount = records.filter(isImageActive).length

    if (ids.length > MAX_IDS) {
      return jsonError({ status: 400, error: `Too many ids (max ${MAX_IDS})` })
    }

    if (!isNil(query.data.active)) {
      const items = sortRecords(records.filter(isImageActive)).slice(0, IMAGE_MAX_ACTIVE)

      return jsonResponse({ items, nextCursor: null, activeCount })
    }

    const filtered = records.filter((record) => {
      if (ids.length > 0) {
        return ids.includes(record.id)
      }

      if (!isNil(query.data.favorite) && !isFavorite(record)) {
        return false
      }

      if (!isNil(query.data.presetId) && record.input.presetId !== query.data.presetId) {
        return false
      }

      return matchesQuery(record, query.data.q ?? '')
    })

    const selected = sortRecords(filtered)

    if (ids.length > 0) {
      return jsonResponse({ items: selected, nextCursor: null, activeCount })
    }

    const page = paginate({
      records: selected,
      cursor: query.data.cursor ?? null,
      limit: query.data.limit,
    })

    return jsonResponse({ ...page, activeCount })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request)
    const body = ImageSubmitSchema.safeParse(await readJsonBody(request))

    if (!body.success) {
      return zodError(body.error)
    }

    const preset = await findImagePresetAny(body.data.presetId)

    if (!preset) {
      return jsonError({ status: 400, error: 'Unknown model' })
    }

    const problems = validateImageInput(preset, body.data)

    if (problems.length > 0) {
      const messages = problems.map(issueText)

      return jsonError({ status: 400, error: messages[0] ?? 'Invalid input', details: messages })
    }

    await secretsReady()

    const binding = primaryBinding(preset)

    if (
      binding.provider !== 'custom' &&
      !isMockMode() &&
      !isNonEmptyString(getSecret('OPENROUTER_API_KEY'))
    ) {
      return jsonError({ status: 400, error: 'OpenRouter key is not set' })
    }

    await loadCatalogEntry(preset.id)
    const price = await priceImage({ preset, input: body.data })

    const created = await withLock('active-images', async () => {
      const activeCount = (await listImages()).filter(isImageActive).length

      if (activeCount >= IMAGE_MAX_ACTIVE) {
        return null
      }

      return createImage({ preset, input: body.data, price })
    })

    if (isNil(created)) {
      const message = `${IMAGE_MAX_ACTIVE} images already generating. Wait for one to finish.`

      return jsonError({ status: 429, error: message })
    }

    return jsonResponse(created, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
