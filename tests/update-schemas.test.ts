import { describe, expect, it } from 'vitest'

import {
  AppInfoSchema,
  AppUpdateSchema,
  InstallResultSchema,
  UpdateCheckSchema,
  UpdateProgressSchema,
} from '@/lib/platform/update-schemas'

describe('update command results', () => {
  it('parses update_info', () => {
    const value = {
      version: '0.2.0',
      installKind: 'macos',
      autoCheck: true,
      lastCheck: '2026-10-25T10:00:00Z',
    }

    expect(AppInfoSchema.parse(value)).toEqual(value)
  })

  it('accepts a missing last check', () => {
    expect(
      AppInfoSchema.parse({
        version: '0.2.0',
        installKind: 'linux-package',
        autoCheck: false,
        lastCheck: null,
      }),
    ).toMatchObject({ lastCheck: null })
  })

  it('parses an available update with notes', () => {
    const value = { version: '0.3.0', notes: 'Fixes', date: null }

    expect(AppUpdateSchema.parse(value)).toEqual(value)
  })

  it('parses update_check with and without an update', () => {
    expect(UpdateCheckSchema.parse(null)).toBeNull()

    expect(
      UpdateCheckSchema.parse({ version: '0.3.0', notes: '', date: '2026-11-01T12:00:00Z' }),
    ).toMatchObject({ version: '0.3.0' })
  })

  it('parses install progress in both phases', () => {
    expect(
      UpdateProgressSchema.parse({ downloaded: 42, total: 100, phase: 'downloading' }),
    ).toMatchObject({ phase: 'downloading' })

    expect(
      UpdateProgressSchema.parse({ downloaded: 0, total: null, phase: 'installing' }),
    ).toMatchObject({ phase: 'installing' })
  })

  it('parses the install result', () => {
    expect(InstallResultSchema.parse({ cancelled: true })).toEqual({ cancelled: true })
  })

  it('rejects a bad payload', () => {
    expect(() => {
      AppInfoSchema.parse({
        version: '0.2.0',
        installKind: 'floppy',
        autoCheck: true,
        lastCheck: null,
      })
    }).toThrow()

    expect(() => {
      UpdateProgressSchema.parse({ downloaded: 1, total: 2, phase: 'paused' })
    }).toThrow()
  })
})
