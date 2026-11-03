import 'server-only'

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { isNil, isString } from 'lodash-es'

const MAX_REDIRECTS = 3

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

interface SafeFetchParams {
  url: string
  hosts: readonly string[]
  timeoutMs: number
}

/** Fetches a provider-supplied URL through https, the adapter allowlist and public IPs. */
export async function safeFetchProviderUrl(params: SafeFetchParams): Promise<Response> {
  const { url, hosts, timeoutMs } = params
  let current = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const target = new URL(current)

    await assertSafeUrl({ target, hosts })

    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!REDIRECT_STATUSES.has(response.status)) {
      return response
    }

    const location = response.headers.get('location')

    if (isNil(location)) {
      return response
    }

    await response.body?.cancel().catch(() => {})

    if (hop === MAX_REDIRECTS) {
      throw new Error('Video URL redirected too many times')
    }

    current = new URL(location, target).href
  }

  throw new Error('Video URL redirected too many times')
}

interface AssertSafeUrlParams {
  target: URL
  hosts: readonly string[]
}

async function assertSafeUrl(params: AssertSafeUrlParams): Promise<void> {
  const { target, hosts } = params

  if (target.protocol !== 'https:') {
    throw new Error('Video URL must use https')
  }

  if (isNil(target.hostname) || !isAllowedHost(target.hostname, hosts)) {
    throw new Error('Video URL host is not allowed')
  }

  const addresses = await resolveAddresses(target.hostname)

  if (addresses.some(isPrivateAddress)) {
    throw new Error('Video URL resolves to a private address')
  }
}

/** Exact host or a subdomain of an allowlisted host. */
function isAllowedHost(host: string, hosts: readonly string[]): boolean {
  const name = host.toLowerCase().replace(/\.$/, '')

  return hosts.some((allowed) => {
    const base = allowed.toLowerCase()

    return name === base || name.endsWith(`.${base}`)
  })
}

async function resolveAddresses(host: string): Promise<string[]> {
  if (isIP(host) !== 0) {
    return [host]
  }

  const records = await lookup(host, { all: true, order: 'verbatim' })

  return records.map((record) => {
    return record.address
  })
}

/** Loopback, private, link-local, CGNAT, multicast and unspecified ranges. */
export function isPrivateAddress(address: string): boolean {
  const ipv4 = ipv4Parts(address)

  if (!isNil(ipv4)) {
    return isPrivateIpv4(ipv4)
  }

  return isPrivateIpv6(address.toLowerCase())
}

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) {
    return null
  }

  return address.split('.').map(Number)
}

interface Ipv4Range {
  first: number
  from: number
  to: number
}

const PRIVATE_IPV4: readonly Ipv4Range[] = [
  { first: 0, from: 0, to: 255 },
  { first: 10, from: 0, to: 255 },
  { first: 100, from: 64, to: 127 },
  { first: 127, from: 0, to: 255 },
  { first: 169, from: 254, to: 254 },
  { first: 172, from: 16, to: 31 },
  { first: 192, from: 168, to: 168 },
  { first: 198, from: 18, to: 19 },
  { first: 224, from: 0, to: 255 },
  { first: 240, from: 0, to: 255 },
]

function isPrivateIpv4(parts: number[]): boolean {
  const [first, second] = parts

  if (isNil(first) || isNil(second)) {
    return true
  }

  return PRIVATE_IPV4.some((range) => {
    return first === range.first && second >= range.from && second <= range.to
  })
}

function isPrivateIpv6(address: string): boolean {
  let plain = address

  if (address.startsWith('[')) {
    plain = address.slice(1, -1)
  }

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(plain)

  if (!isNil(mapped) && isString(mapped[1])) {
    const parts = mapped[1].split('.').map(Number)

    return isPrivateIpv4(parts)
  }

  if (plain === '::' || plain === '::1') {
    return true
  }

  const head = plain.split(':')[0] ?? ''
  const prefix = Number.parseInt(head, 16)

  if (!Number.isFinite(prefix)) {
    return true
  }

  return (
    (prefix & 0xfe00) === 0xfc00 || (prefix & 0xffc0) === 0xfe80 || (prefix & 0xff00) === 0xff00
  )
}
