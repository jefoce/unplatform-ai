import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

const TOKEN = 'a'.repeat(64)
const PARENT_SECRET = 'b'.repeat(64)

const SYSTEM_URL = 'http://127.0.0.1:3000/api/system/export-path'

async function load(appToken = TOKEN, parentSecret = PARENT_SECRET) {
  vi.resetModules()
  vi.stubEnv('APP_TOKEN', appToken)

  if (parentSecret === '') {
    vi.stubEnv('APP_TOKEN_FILE', '')
  } else {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'cf-export-path-'))
    const file = path.join(dir, 'session')

    await writeFile(file, JSON.stringify({ token: appToken, parentSecret }), { mode: 0o600 })
    vi.stubEnv('APP_TOKEN_FILE', file)
  }

  const route = await import('@/app/api/system/export-path/route')
  const tokens = await import('@/server/services/export-tokens')

  return {
    POST: route.POST,
    consumeExportPath: tokens.consumeExportPath,
    consumeExportFolder: tokens.consumeExportFolder,
  }
}

interface RequestParams {
  body: unknown
  secret?: string
  token?: string
}

function makeRequest(params: RequestParams): Request {
  const { body, secret = PARENT_SECRET, token = TOKEN } = params

  const headers: Record<string, string> = {
    host: '127.0.0.1:3000',
    'content-type': 'application/json',
    cookie: `upai_session=${token}`,
    'sec-fetch-site': 'same-origin',
  }

  if (secret !== '') {
    headers['x-unplatform-ai-parent'] = secret
  }

  return new Request(SYSTEM_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/system/export-path', () => {
  it('registers a dialog path for the parent once', async () => {
    const { POST, consumeExportPath } = await load()
    const target = path.join('/tmp', `dialog-${TOKEN.slice(0, 4)}-${Date.now()}.mp4`)

    const response = await POST(makeRequest({ body: { path: target } }))

    expect(response.status).toBe(204)
    expect(consumeExportPath(target)).toBe(true)
    expect(consumeExportPath(target)).toBe(false)
  })

  it('registers a folder grant for the given number of batch requests', async () => {
    const { POST, consumeExportFolder } = await load()
    const dir = `/tmp/folder-${Date.now()}`

    const response = await POST(makeRequest({ body: { folder: dir, uses: 2 } }))

    expect(response.status).toBe(204)
    expect(consumeExportFolder(dir)).toBe(true)
    expect(consumeExportFolder(dir)).toBe(true)
    expect(consumeExportFolder(dir)).toBe(false)
  })

  it('rejects a folder grant without a use count', async () => {
    const { POST } = await load()

    const response = await POST(makeRequest({ body: { folder: '/tmp/no-uses' } }))

    expect(response.status).toBe(400)
  })

  it('forbids a caller without the parent secret', async () => {
    const { POST, consumeExportPath } = await load()
    const target = `/tmp/no-secret-${Date.now()}.mp4`

    const response = await POST(makeRequest({ body: { path: target }, secret: '' }))

    expect(response.status).toBe(403)
    expect(consumeExportPath(target)).toBe(false)
  })

  it('forbids a wrong parent secret', async () => {
    const { POST } = await load()
    const response = await POST(makeRequest({ body: { path: '/tmp/wrong.mp4' }, secret: 'nope' }))

    expect(response.status).toBe(403)
  })

  it('404s in browser mode', async () => {
    const { POST } = await load('', '')
    const response = await POST(makeRequest({ body: { path: '/tmp/browser.mp4' } }))

    expect(response.status).toBe(404)
  })
})
