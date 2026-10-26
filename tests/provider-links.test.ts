import fs from 'node:fs/promises'
import path from 'node:path'

import { isNil, isString } from 'lodash-es'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { OPENROUTER_CREDITS_URL } from '@/core/providers/openrouter'
import { STORAGE_PROVIDERS, VIDEO_PROVIDERS } from '@/core/providers/registry'
import type { ProviderLink } from '@/core/providers/types'

const CAPABILITIES_PATH = path.join(process.cwd(), 'src-tauri/capabilities/default.json')
const OPENER_PERMISSION = 'opener:allow-open-url'

const RuleSchema = z.object({ url: z.string() })

const PermissionSchema = z.union([
  z.string(),
  z.object({ identifier: z.string(), allow: z.array(RuleSchema).optional() }),
])

const CapabilitiesSchema = z.object({ permissions: z.array(PermissionSchema) })

/** Turns a Tauri opener glob into an anchored regex. */
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const pattern = escaped.replaceAll('*', '.*')

  return new RegExp(`^${pattern}$`)
}

function linkUrls(links: readonly ProviderLink[]): string[] {
  return links.map((link) => {
    return link.url
  })
}

function isAllowed(patterns: RegExp[], url: string): boolean {
  return patterns.some((pattern) => {
    return pattern.test(url)
  })
}

async function openerGlobs(): Promise<string[]> {
  const raw = await fs.readFile(CAPABILITIES_PATH, 'utf8')
  const parsed = CapabilitiesSchema.parse(JSON.parse(raw))

  const permission = parsed.permissions.find((entry) => {
    return !isString(entry) && entry.identifier === OPENER_PERMISSION
  })

  if (isNil(permission) || isString(permission)) {
    throw new Error(`Missing ${OPENER_PERMISSION} in default.json`)
  }

  if (isNil(permission.allow)) {
    throw new Error(`Missing allow list on ${OPENER_PERMISSION}`)
  }

  return permission.allow.map((rule) => {
    return rule.url
  })
}

describe('provider links', () => {
  it('lists the setup guide for every provider', () => {
    const descriptors = [...VIDEO_PROVIDERS, ...STORAGE_PROVIDERS]

    for (const descriptor of descriptors) {
      const labels = descriptor.links.map((link) => {
        return link.label
      })

      expect(labels).toContain('Setup guide')
    }
  })

  it('allows every provider link in the Tauri opener capability', async () => {
    const patterns = (await openerGlobs()).map(globToRegex)
    const descriptors = [...VIDEO_PROVIDERS, ...STORAGE_PROVIDERS]

    const urls = descriptors.flatMap((descriptor) => {
      return linkUrls(descriptor.links)
    })

    urls.push(OPENROUTER_CREDITS_URL)

    const unreachable = urls.filter((url) => {
      return !isAllowed(patterns, url)
    })

    expect(patterns.length > 0).toBe(true)
    expect(unreachable).toEqual([])
  })
})
