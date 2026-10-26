import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isString } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import { isRecord } from '@/core/guards'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONFIGS = ['tauri.conf.json', 'tauri.release.conf.json']

const INSECURE_KEYS = new Set([
  'dangerousInsecureTransportProtocol',
  'dangerous-insecure-transport-protocol',
])

/** Finds the insecure transport key at any depth, returning its path. */
function findInsecureKey(value: unknown, parent = ''): string | null {
  if (Array.isArray(value)) {
    return (
      value
        .map((item, index) => {
          return findInsecureKey(item, `${parent}[${index}]`)
        })
        .find((found) => {
          return found !== null
        }) ?? null
    )
  }

  if (!isRecord(value)) {
    return null
  }

  return (
    Object.keys(value)
      .map((key) => {
        const here = parent === '' ? key : `${parent}.${key}`

        if (INSECURE_KEYS.has(key)) {
          return here
        }

        return findInsecureKey(value[key], here)
      })
      .find((found) => {
        return found !== null
      }) ?? null
  )
}

/** Reads the bundle targets list from a config object. */
function bundleTargets(config: unknown): string[] {
  if (!isRecord(config)) {
    return []
  }

  const bundle = config.bundle

  if (!isRecord(bundle) || !Array.isArray(bundle.targets)) {
    return []
  }

  return bundle.targets.filter(isString)
}

describe('updater config', () => {
  it('builds the macOS app target for updater artifacts', () => {
    const file = path.join(ROOT, 'src-tauri', 'tauri.conf.json')
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
    const targets = bundleTargets(config)

    expect(targets).toEqual(expect.arrayContaining(['app', 'nsis', 'appimage']))
    expect(targets[0]).toBe('app')
  })

  it.each(CONFIGS)('%s does not allow insecure transport', (name) => {
    const file = path.join(ROOT, 'src-tauri', name)
    const config = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown

    expect(findInsecureKey(config)).toBeNull()
  })

  it('finds the flag when it is nested', () => {
    const config = {
      plugins: { updater: [{ dangerousInsecureTransportProtocol: true }] },
    }

    expect(findInsecureKey(config)).toBe('plugins.updater[0].dangerousInsecureTransportProtocol')
  })
})
