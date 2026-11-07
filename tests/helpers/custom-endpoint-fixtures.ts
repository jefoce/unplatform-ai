import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { vi } from 'vitest'

import type { MediaKind } from '@/core/media/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

export interface Route {
  method: string
  path: string
  status: number
  body?: unknown
}

interface WriteUploadParams {
  uploadsDir: string
  bytes: Buffer
  ext: string
  mime: string
  kind: MediaKind
}

function respond(route: Route): Response {
  if (isNil(route.body)) {
    return new Response(null, { status: route.status })
  }

  return new Response(JSON.stringify(route.body), {
    status: route.status,
    headers: { 'content-type': 'application/json' },
  })
}

export function mockFetch(routes: Route[]): void {
  const mock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(inputUrl(input))

    const method = init?.method ?? 'GET'

    const route = routes.find((item) => {
      return item.method === method && item.path === url.pathname
    })

    if (!route) {
      throw new Error(`Unexpected request: ${method} ${url.pathname}`)
    }

    return respond(route)
  })

  vi.stubGlobal('fetch', mock)
}

function inputUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.href
  }

  return input.url
}

export function healthRoute(maxUploadBytes: number): Route {
  return {
    method: 'GET',
    path: '/upai/api/v1/health',
    status: 200,
    body: {
      protocol: 1,
      server: 'mock',
      server_version: 'mock',
      implementation: 'mock',
      implementation_version: '0.1.0',
      auth_required: false,
      lan_allowed: false,
      max_upload_bytes: maxUploadBytes,
      upload_quota_bytes: 1024 ** 3,
      instance_id: '11111111-1111-4111-8111-111111111111',
      max_running: 1,
    },
  }
}

export function uploadRoute(sha256: string): Route {
  return {
    method: 'POST',
    path: '/upai/api/v1/uploads',
    status: 201,
    body: {
      sha256,
      ref: `upai-upload:${sha256}`,
      size: 11,
      content_type: 'video/mp4',
      filename: 'ref.mp4',
    },
  }
}

export async function writeUpload(params: WriteUploadParams): Promise<UploadItem> {
  const { uploadsDir, bytes, ext, mime, kind } = params
  const id = `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`

  await fs.mkdir(uploadsDir, { recursive: true })
  await fs.writeFile(path.join(uploadsDir, `${id}${ext}`), bytes)

  return {
    id,
    source: 'file',
    kind,
    mime,
    ext,
    originalName: `ref${ext}`,
    sizeBytes: bytes.length,
    createdAt: new Date().toISOString(),
  }
}

export function sha256Of(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
