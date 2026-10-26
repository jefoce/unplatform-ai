import { describe, expect, it } from 'vitest'

import { getPreset } from '@/core/presets'
import { primaryBinding } from '@/core/presets/bindings'
import { resolveTransport } from '@/core/transport'

const wan = getPreset('wan-3.0')
const seedance = getPreset('seedance-2.0')

describe('resolveTransport', () => {
  it('returns an explicit transport regardless of remote config', () => {
    expect(
      resolveTransport({
        binding: primaryBinding(seedance),
        kind: 'video',
        remoteConfigured: false,
      }),
    ).toBe('url')

    expect(
      resolveTransport({ binding: primaryBinding(wan), kind: 'image', remoteConfigured: true }),
    ).toBe('base64')
  })

  it('keeps Wan video and audio on url without remote config', () => {
    expect(
      resolveTransport({ binding: primaryBinding(wan), kind: 'video', remoteConfigured: true }),
    ).toBe('url')

    expect(
      resolveTransport({ binding: primaryBinding(wan), kind: 'video', remoteConfigured: false }),
    ).toBe('url')

    expect(
      resolveTransport({ binding: primaryBinding(wan), kind: 'audio', remoteConfigured: false }),
    ).toBe('url')
  })

  it('resolves auto to url only when remote storage is configured', () => {
    expect(
      resolveTransport({
        binding: primaryBinding(seedance),
        kind: 'audio',
        remoteConfigured: true,
      }),
    ).toBe('url')

    expect(
      resolveTransport({
        binding: primaryBinding(seedance),
        kind: 'audio',
        remoteConfigured: false,
      }),
    ).toBe('base64')
  })
})
