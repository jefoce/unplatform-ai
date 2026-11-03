import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => {
  return vi.fn<(host: string) => Promise<{ address: string; family: number }[]>>()
})

vi.mock('node:dns/promises', () => {
  return { lookup }
})

const { isPrivateAddress, safeFetchProviderUrl } = await import('@/server/providers/safe-fetch')

const PUBLIC = [{ address: '93.184.216.34', family: 4 }]
const HOSTS = ['openrouter.ai']

const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>()

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { location: to } })
}

function ok(): Response {
  return new Response('video')
}

async function call(url: string): Promise<Response> {
  return safeFetchProviderUrl({ url, hosts: HOSTS, timeoutMs: 5000 })
}

beforeEach(() => {
  lookup.mockResolvedValue(PUBLIC)
  fetchMock.mockResolvedValue(ok())
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('safeFetchProviderUrl', () => {
  it('fetches an allowlisted https URL', async () => {
    const response = await call('https://openrouter.ai/video.mp4')

    expect(await response.text()).toBe('video')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('allows a subdomain of an allowlisted host', async () => {
    await call('https://cdn.openrouter.ai/video.mp4')

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects plain http', async () => {
    await expect(call('http://openrouter.ai/video.mp4')).rejects.toThrow('https')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a host outside the allowlist', async () => {
    await expect(call('https://evil.example/video.mp4')).rejects.toThrow('not allowed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects loopback, private and link-local answers', async () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.1.1', '::1']) {
      lookup.mockResolvedValueOnce([{ address, family: 4 }])

      await expect(call('https://openrouter.ai/video.mp4')).rejects.toThrow('private address')
    }

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a literal private host even when allowlisted', async () => {
    await expect(
      safeFetchProviderUrl({
        url: 'https://127.0.0.1/video.mp4',
        hosts: ['127.0.0.1'],
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('private address')
  })

  it('follows a redirect to another allowlisted host', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://cdn.openrouter.ai/video.mp4'))

    const response = await call('https://openrouter.ai/video.mp4')

    expect(await response.text()).toBe('video')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a redirect to a host outside the allowlist', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://evil.example/video.mp4'))

    await expect(call('https://openrouter.ai/video.mp4')).rejects.toThrow('not allowed')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('rejects a redirect to http', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://openrouter.ai/video.mp4'))

    await expect(call('https://openrouter.ai/video.mp4')).rejects.toThrow('https')
  })

  it('rejects more than three redirects', async () => {
    fetchMock.mockResolvedValue(redirect('https://openrouter.ai/again'))

    await expect(call('https://openrouter.ai/video.mp4')).rejects.toThrow('too many times')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

describe('isPrivateAddress', () => {
  it('flags every reserved IPv4 and IPv6 range', () => {
    const privateAddresses = [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '240.0.0.1',
      '::',
      '::1',
      'fc00::1',
      'fd12::1',
      'fe80::1',
      'ff02::1',
      '::ffff:127.0.0.1',
    ]

    expect(
      privateAddresses.filter((address) => {
        return !isPrivateAddress(address)
      }),
    ).toEqual([])
  })

  it('allows public addresses', () => {
    const publicAddresses = ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2001:db8::1']

    expect(
      publicAddresses.filter((address) => {
        return isPrivateAddress(address)
      }),
    ).toEqual([])
  })
})
