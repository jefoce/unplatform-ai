import http from 'node:http'

import { isNil } from 'lodash-es'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { request } from '@/server/providers/openrouter/http'

interface ReceivedRequest {
  path: string
  authorization: string | undefined
}

const received: ReceivedRequest[] = []

let originA = ''
let originB = ''
let serverA: http.Server | null = null
let serverB: http.Server | null = null

function record(incoming: http.IncomingMessage): void {
  received.push({ path: incoming.url ?? '', authorization: incoming.headers.authorization })
}

function handleA(incoming: http.IncomingMessage, response: http.ServerResponse): void {
  record(incoming)

  if (incoming.url === '/cross-origin') {
    response.writeHead(302, { Location: `${originB}/content` })
    response.end()

    return
  }

  if (incoming.url === '/same-origin') {
    response.writeHead(302, { Location: '/same-target' })
    response.end()

    return
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('same-origin-body')
}

function handleB(incoming: http.IncomingMessage, response: http.ServerResponse): void {
  record(incoming)
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('cross-origin-body')
}

function find(path: string): ReceivedRequest {
  const match = received.find((item) => {
    return item.path === path
  })

  if (isNil(match)) {
    throw new Error(`No request recorded for ${path}`)
  }

  return match
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      reject(new Error('Local test server failed to start', { cause: error }))
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (isNil(address) || typeof address === 'string') {
        reject(new Error('Local test server has no TCP address'))

        return
      }

      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

async function close(server: http.Server | null): Promise<void> {
  if (isNil(server)) {
    return
  }

  server.closeAllConnections()

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (isNil(error)) {
        resolve()

        return
      }

      reject(error)
    })
  })
}

function contentInit(): RequestInit {
  return {
    headers: { Authorization: 'Bearer test-key', 'X-Title': 'Unplatform AI' },
    cache: 'no-store',
    redirect: 'follow',
  }
}

beforeAll(async () => {
  serverA = http.createServer((incoming, response) => {
    handleA(incoming, response)
  })

  serverB = http.createServer((incoming, response) => {
    handleB(incoming, response)
  })

  originA = await listen(serverA)
  originB = await listen(serverB)
})

afterAll(async () => {
  await close(serverA)
  await close(serverB)
})

describe('openrouter content redirect', () => {
  it('drops the Authorization header on a cross-origin redirect', async () => {
    const response = await request({
      url: `${originA}/cross-origin`,
      init: contentInit(),
      timeoutMs: 5000,
    })

    expect(find('/cross-origin').authorization).toBe('Bearer test-key')
    expect(find('/content').authorization).toBeUndefined()
    expect(await response.text()).toBe('cross-origin-body')
  })

  it('keeps the Authorization header on a same-origin redirect', async () => {
    const response = await request({
      url: `${originA}/same-origin`,
      init: contentInit(),
      timeoutMs: 5000,
    })

    expect(find('/same-origin').authorization).toBe('Bearer test-key')
    expect(find('/same-target').authorization).toBe('Bearer test-key')
    expect(await response.text()).toBe('same-origin-body')
  })
})
