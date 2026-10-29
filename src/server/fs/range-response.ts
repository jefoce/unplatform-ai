import 'server-only'

import { createReadStream, type Stats } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import { isNil } from 'lodash-es'

import { isNonEmptyString } from '@/core/guards'
import { mimeFromExt } from '@/core/media-kinds'

interface Range {
  start: number
  end: number
}

interface StreamOptions {
  downloadName?: string
  cacheControl?: string
  etag?: string
}

interface StreamFileParams {
  absPath: string
  request: Request
  opts?: StreamOptions
}

export async function streamFile(params: StreamFileParams): Promise<Response> {
  const { absPath, request, opts = {} } = params
  const stats = await statFile(absPath)

  if (!stats) {
    return notFound()
  }

  const size = stats.size
  const etag = opts.etag ?? `W/"${size}-${Math.floor(stats.mtimeMs)}"`
  const headers = buildHeaders({ absPath, stats, opts, etag })

  if (isNotModified(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers })
  }

  const rangeHeader = request.headers.get('range')

  return rangeResponse({
    absPath,
    request,
    headers,
    rangeHeader,
    range: parseRange(rangeHeader ?? '', size),
    size,
  })
}

async function statFile(absPath: string): Promise<Stats | null> {
  const stats = await fs.stat(absPath).catch(() => {
    return null
  })

  if (isNil(stats) || !stats.isFile()) {
    return null
  }

  return stats
}

interface BuildHeadersParams {
  absPath: string
  stats: Stats
  opts: StreamOptions
  etag: string
}

function buildHeaders(params: BuildHeadersParams): Headers {
  const { absPath, stats, opts, etag } = params

  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeFromExt(path.extname(absPath)) ?? 'application/octet-stream',
  })

  if (isNonEmptyString(opts.cacheControl)) {
    headers.set('Cache-Control', opts.cacheControl)
  }

  if (isNonEmptyString(opts.downloadName)) {
    headers.set('Content-Disposition', `attachment; filename="${sanitizeName(opts.downloadName)}"`)
  }

  headers.set('ETag', etag)
  headers.set('Last-Modified', stats.mtime.toUTCString())

  return headers
}

interface RangeResponseParams {
  absPath: string
  request: Request
  headers: Headers
  rangeHeader: string | null
  range: Range | null
  size: number
}

function rangeResponse(params: RangeResponseParams): Response {
  const { absPath, request, headers, rangeHeader, range, size } = params

  if (isNonEmptyString(rangeHeader) && isNil(range)) {
    headers.set('Content-Range', `bytes */${size}`)
    headers.set('Content-Length', '0')

    return new Response(null, { status: 416, headers })
  }

  const length = range ? range.end - range.start + 1 : size

  headers.set('Content-Length', String(length))

  if (range) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  }

  const status = range ? 206 : 200

  if (request.method === 'HEAD') {
    return new Response(null, { status, headers })
  }

  const stream = createReadStream(absPath, range ?? undefined)

  return new Response(Readable.toWeb(stream) as ReadableStream, { status, headers })
}

function parseRange(header: string, size: number): Range | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())

  if (!match || size === 0) {
    return null
  }

  const [, rawStart, rawEnd] = match

  if (isNil(rawStart) || isNil(rawEnd)) {
    return null
  }

  if (rawStart === '') {
    return parseSuffix(rawEnd, size)
  }

  return parseBounds({ rawStart, rawEnd, size })
}

function parseSuffix(rawEnd: string, size: number): Range | null {
  if (rawEnd === '') {
    return null
  }

  const suffix = Number(rawEnd)

  if (!Number.isSafeInteger(suffix) || suffix <= 0) {
    return null
  }

  return { start: Math.max(0, size - suffix), end: size - 1 }
}

interface ParseBoundsParams {
  rawStart: string
  rawEnd: string
  size: number
}

function parseBounds(params: ParseBoundsParams): Range | null {
  const { rawStart, rawEnd, size } = params
  const start = Number(rawStart)
  let end = Number(rawEnd)

  if (rawEnd === '') {
    end = size - 1
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    return null
  }

  if (start >= size || start > end) {
    return null
  }

  return { start, end: Math.min(end, size - 1) }
}

/** Weak comparison against a comma-separated If-None-Match list. */
function isNotModified(header: string | null, etag: string): boolean {
  if (!isNonEmptyString(header)) {
    return false
  }

  if (header.trim() === '*') {
    return true
  }

  const opaque = etag.replace(/^W\//, '')

  return header.split(',').some((tag) => {
    return tag.trim().replace(/^W\//, '') === opaque
  })
}

function sanitizeName(name: string): string {
  return name.replaceAll(/["\r\n\\/]/g, '_')
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}
