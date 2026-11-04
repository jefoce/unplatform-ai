'use strict'

/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload must stay CommonJS */

/** Blocks non-loopback network calls made by the e2e server. Preloaded with `--require`. */

const MARKER = '[e2e-outbound] blocked'
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0'])

function block(target) {
  const text = `${MARKER} ${target}`
  process.stderr.write(`${text}\n`)
  throw new Error(text)
}

function isLocalHostname(hostname) {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  return LOCAL_HOSTS.has(lower) || lower.endsWith('.localhost')
}

function checkUrl(value) {
  const text = value instanceof URL ? value.href : value

  if (typeof text !== 'string' || text === '') {
    return
  }

  if (text.startsWith('/') || text.startsWith('?')) {
    return
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    return
  }

  let url

  try {
    url = new URL(text)
  } catch {
    return
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return
  }

  if (!isLocalHostname(url.hostname)) {
    block(text)
  }
}

function checkOptions(options) {
  if (options.socketPath !== undefined) {
    return
  }

  const host = options.hostname ?? options.host

  if (typeof host !== 'string' || host === '') {
    return
  }

  let hostname = host

  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']')
    hostname = end === -1 ? hostname : hostname.slice(0, end + 1)
  } else {
    const colon = hostname.indexOf(':')
    hostname = colon === -1 ? hostname : hostname.slice(0, colon)
  }

  if (!isLocalHostname(hostname)) {
    block(host)
  }
}

function checkArgs(args) {
  for (const arg of args) {
    if (typeof arg === 'string' || arg instanceof URL) {
      checkUrl(arg)
      continue
    }

    if (typeof Request !== 'undefined' && arg instanceof Request) {
      checkUrl(arg.url)
      continue
    }

    if (typeof arg === 'object' && arg !== null) {
      checkOptions(arg)
    }
  }
}

if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch

  globalThis.fetch = function guardedFetch(...args) {
    checkArgs(args)

    return originalFetch.apply(this, args)
  }
}

for (const name of ['node:http', 'node:https']) {
  const mod = require(name)

  for (const method of ['request', 'get']) {
    const original = mod[method]

    mod[method] = function guardedRequest(...args) {
      checkArgs(args)

      return original.apply(this, args)
    }
  }
}
