import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil } from 'lodash-es'

import { HttpError } from '../errors'

const HEADER_LIMIT = 16 * 1024

export interface StreamedFile {
  name: string
  path: string
  size: number
}

interface StreamMultipartParams {
  request: Request
  dir: string
  maxBytes: number
  maxFiles?: number
}

interface ParserParams {
  boundary: string
  dir: string
  maxBytes: number
  maxFiles?: number
}

interface CurrentFile {
  name: string
  path: string
  size: number
}

type ParseState = 'preamble' | 'headers' | 'body' | 'done'

export async function streamMultipartFiles(params: StreamMultipartParams): Promise<StreamedFile[]> {
  const { request, dir, maxBytes, maxFiles = Number.POSITIVE_INFINITY } = params
  const boundary = boundaryOf(request.headers.get('content-type'))

  if (isNil(boundary)) {
    throw new HttpError(400, 'Invalid form data')
  }

  const body = request.body

  if (isNil(body)) {
    throw new HttpError(400, 'No files provided')
  }

  const parser = new MultipartParser({ boundary, dir, maxBytes, maxFiles })
  const chunks = body as unknown as AsyncIterable<Uint8Array>

  try {
    for await (const chunk of chunks) {
      await parser.push(Buffer.from(chunk))
    }

    return await parser.finish()
  } catch (error) {
    await body.cancel().catch(() => {})
    await parser.cleanup()

    throw error
  }
}

function boundaryOf(contentType: string | null): string | null {
  if (isNil(contentType)) {
    return null
  }

  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)

  return match?.[1] ?? match?.[2]?.trim() ?? null
}

class MultipartParser {
  private readonly delimiter: string
  private readonly fileDelimiter: string
  private readonly dir: string
  private readonly maxBytes: number
  private readonly maxFiles: number
  private readonly files: StreamedFile[] = []
  private buffer = Buffer.alloc(0)
  private state: ParseState = 'preamble'
  private current: CurrentFile | null = null
  private total = 0

  constructor(params: ParserParams) {
    const { boundary, dir, maxBytes, maxFiles = Number.POSITIVE_INFINITY } = params

    this.delimiter = `--${boundary}`
    this.fileDelimiter = `\r\n--${boundary}`
    this.dir = dir
    this.maxBytes = maxBytes
    this.maxFiles = maxFiles
  }

  async push(chunk: Buffer): Promise<void> {
    this.total += chunk.byteLength

    if (this.total > this.maxBytes) {
      throw new HttpError(413, 'Upload too large')
    }

    this.buffer = Buffer.concat([this.buffer, chunk])

    while (await this.step()) {
      // Keeps consuming until the buffered bytes stop being enough.
    }
  }

  async finish(): Promise<StreamedFile[]> {
    if (this.state !== 'done' || !isNil(this.current)) {
      throw new HttpError(400, 'Invalid form data')
    }

    return this.files
  }

  async cleanup(): Promise<void> {
    const paths = this.files.map((file) => {
      return file.path
    })

    if (!isNil(this.current)) {
      paths.push(this.current.path)
    }

    await Promise.all(
      paths.map((file) => {
        return fs.unlink(file).catch(() => {})
      }),
    )
  }

  /** Returns true when more bytes can be consumed now. */
  private async step(): Promise<boolean> {
    if (this.state === 'preamble') {
      return this.stepPreamble()
    }

    if (this.state === 'headers') {
      return this.stepHeaders()
    }

    if (this.state === 'body') {
      return this.stepBody()
    }

    return false
  }

  private stepPreamble(): boolean {
    const start = this.buffer.indexOf(this.delimiter)

    if (start < 0) {
      return this.keepTail(this.delimiter.length + 4)
    }

    this.buffer = this.buffer.subarray(start + this.delimiter.length)

    return this.afterDelimiter()
  }

  private afterDelimiter(): boolean {
    if (this.buffer.byteLength < 2) {
      return false
    }

    const marker = this.buffer.subarray(0, 2).toString('latin1')

    if (marker === '--') {
      this.state = 'done'
      this.buffer = Buffer.alloc(0)

      return false
    }

    if (marker !== '\r\n') {
      this.buffer = this.buffer.subarray(2)
      this.state = 'preamble'

      return true
    }

    this.buffer = this.buffer.subarray(2)
    this.state = 'headers'

    return true
  }

  private stepHeaders(): boolean {
    const end = this.buffer.indexOf('\r\n\r\n')

    if (end < 0) {
      if (this.buffer.byteLength > HEADER_LIMIT) {
        throw new HttpError(400, 'Invalid form data')
      }

      return false
    }

    const head = this.buffer.subarray(0, end).toString('latin1')

    this.buffer = this.buffer.subarray(end + 4)

    return this.startPart(head)
  }

  private startPart(head: string): boolean {
    const name = dispositionValue(head, 'filename')

    if (isNil(name)) {
      this.state = 'body'

      return true
    }

    if (this.files.length >= this.maxFiles) {
      throw new HttpError(413, 'Too many files')
    }

    this.current = {
      name,
      path: path.join(this.dir, `upload-${randomUUID()}.tmp-`),
      size: 0,
    }

    this.state = 'body'

    return true
  }

  private async stepBody(): Promise<boolean> {
    const at = this.buffer.indexOf(this.fileDelimiter)

    if (at < 0) {
      const keep = this.fileDelimiter.length - 1
      const writable = Math.max(0, this.buffer.byteLength - keep)

      if (writable > 0) {
        await this.write(this.buffer.subarray(0, writable))
        this.buffer = this.buffer.subarray(writable)
      }

      return false
    }

    await this.write(this.buffer.subarray(0, at))
    this.buffer = this.buffer.subarray(at + this.fileDelimiter.length)
    this.closeCurrent()
    this.state = 'headers'

    return this.afterDelimiter()
  }

  private async write(bytes: Buffer): Promise<void> {
    if (isNil(this.current) || bytes.byteLength === 0) {
      return
    }

    this.current.size += bytes.byteLength

    if (this.current.size > this.maxBytes) {
      throw new HttpError(413, 'Upload too large')
    }

    await fs.appendFile(this.current.path, bytes, { mode: 0o600 })
  }

  private closeCurrent(): void {
    const file = this.current

    if (isNil(file)) {
      return
    }

    this.current = null
    this.files.push({ name: file.name, path: file.path, size: file.size })
  }

  private keepTail(length: number): boolean {
    if (this.buffer.byteLength <= length) {
      return false
    }

    this.buffer = this.buffer.subarray(this.buffer.byteLength - length)

    return false
  }
}

function dispositionValue(head: string, field: string): string | null {
  const disposition = head.split('\r\n').find((line) => {
    return line.toLowerCase().startsWith('content-disposition:')
  })

  if (isNil(disposition)) {
    return null
  }

  const match = new RegExp(`${field}="([^"]*)"`, 'i').exec(disposition)

  return match?.[1] ?? null
}
