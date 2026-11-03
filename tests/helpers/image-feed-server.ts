import { isBoolean, isNil } from 'lodash-es'

import type { ImageListResult } from '@/core/api/image'
import { isRecord } from '@/core/guards'
import type { ImageOutput, ImageRecord } from '@/core/schemas/image-record'

export interface ImageFeedServer {
  records: ImageRecord[]
  activeCount: number
  patchGate: Promise<void> | null
  patchBodies: boolean[]
}

const CREATED_AT = '2026-01-01T00:00:00.000Z'

export function createFeedServer(): ImageFeedServer {
  return { records: [], activeCount: 0, patchGate: null, patchBodies: [] }
}

function patchBodyFavorite(init?: RequestInit): boolean {
  const body: unknown = JSON.parse(String(init?.body ?? '{}'))

  if (!isRecord(body) || !isBoolean(body.favorite)) {
    throw new Error('Missing favorite body')
  }

  return body.favorite
}

function savedOutput(id: string, isFavorite: boolean): ImageOutput {
  return {
    id,
    index: 0,
    status: 'saved',
    file: `${id}.png`,
    mediaType: 'image/png',
    width: 1024,
    height: 1024,
    bytes: 1,
    favorite: isFavorite,
    seed: null,
  }
}

export function feedRecord(
  id: string,
  isFavorite: boolean,
  status: ImageRecord['status'] = 'completed',
): ImageRecord {
  return {
    id,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    status,
    provider: 'openrouter',
    preset: { id: 'seedream-5-0-flash', title: 'Seedream', slug: 'seedream-5-0-flash' },
    input: {
      presetId: 'seedream-5-0-flash',
      prompt: 'a cat',
      count: 1,
      aspectRatio: '1:1',
      resolution: '1K',
      quality: null,
      background: null,
      references: [],
      seed: null,
    },
    outputs: status === 'submitting' ? [] : [savedOutput(`${id}-out`, isFavorite)],
    seedUsed: null,
    cost: {
      currency: 'USD',
      unit: 'image',
      estimatedUsd: 0,
      actualUsd: null,
      priceSource: 'mock',
      billed: null,
    },
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function hasSavedFavorite(item: ImageRecord): boolean {
  return item.outputs.some((output) => {
    return output.status === 'saved' && output.favorite
  })
}

function feedPage(server: ImageFeedServer, isFavorite: boolean): ImageListResult {
  const items = isFavorite
    ? server.records.filter((item) => {
        return hasSavedFavorite(item)
      })
    : server.records

  return { items, nextCursor: null, activeCount: server.activeCount }
}

function runPatch(server: ImageFeedServer, url: string): ImageRecord {
  const [, , , recordId, , outputId] = url.split('/')

  const source = server.records.find((item) => {
    return item.id === recordId
  })

  if (isNil(source)) {
    throw new Error(`Missing record ${recordId}`)
  }

  const outputs = source.outputs.map((item) => {
    if (item.id !== outputId || item.status !== 'saved') {
      return item
    }

    return { ...item, favorite: !item.favorite }
  })

  const next = { ...source, outputs, updatedAt: new Date().toISOString() }

  server.records = server.records.map((item) => {
    return item.id === source.id ? next : item
  })

  return next
}

async function handleFetch(server: ImageFeedServer, input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input)
  const method = init?.method ?? 'GET'

  if (method === 'GET' && url.startsWith('/api/credits')) {
    return jsonResponse({})
  }

  if (method === 'PATCH') {
    server.patchBodies.push(patchBodyFavorite(init))

    await server.patchGate

    return jsonResponse(runPatch(server, url))
  }

  if (method === 'POST') {
    const created = feedRecord('new', false)

    server.records = [created, ...server.records]

    return jsonResponse(created)
  }

  return jsonResponse(feedPage(server, url.includes('favorite=1')))
}

/** Fetch stub for one mounted feed server. */
export function feedFetch(server: ImageFeedServer) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return handleFetch(server, input, init)
  }
}

interface FetchArgs {
  init?: RequestInit
}

export function isPageFetch(input: RequestInfo | URL, args?: FetchArgs): boolean {
  return (args?.init?.method ?? 'GET') === 'GET' && String(input).startsWith('/api/images')
}
