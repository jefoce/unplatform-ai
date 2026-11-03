import fs from 'node:fs'
import path from 'node:path'

import { isEmpty, uniq } from 'lodash-es'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import * as bounds from '../src/core/constants'
import { SECRET_NAMES } from '../src/core/secret-names'
import { file, tableRows } from './helpers/docs-tables'
import { required } from './helpers/required'

const SOURCE_ROOTS = ['src', 'src-tauri/src', 'scripts', 'tests']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.rs'])

const ENV_READS = [
  /\bprocess\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /\b(?:std::)?env::var(?:_os)?\("([A-Z][A-Z0-9_]*)"\)/g,
  /\bnumberFromEnv\('([A-Z][A-Z0-9_]*)'/g,
]

/** Build-only names documented in section 12 to 14, plus build orchestration. */
const BUILD_ONLY = new Set([
  'CI',
  'ALLOW_NONFREE_FFMPEG',
  'ALLOW_OFFICIAL_NODE',
  'FFMPEG_BINARY',
  'FFMPEG_PROFILE',
  'NODE_BINARY',
  'UPAI_PREPARED',
  'TAURI_ENV_TARGET_TRIPLE',
  'TAURI_SIGNING_PRIVATE_KEY',
])

/** Framework, runtime and injected names that are not user-facing app config. */
const INTERNAL = new Set([
  'APPIMAGE',
  'HOSTNAME',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_RUNTIME',
  'NODE_ENV',
  'CHROME_PATH',
  'E2E_CDP_PORT',
  'E2E_KEEP_TMP',
  'E2E_SKIP_BUILD',
  'E2E_TMPDIR',
])

const CapabilitySchema = z.object({
  permissions: z.array(z.unknown()),
})

const OpenerSchema = z.object({
  identifier: z.literal('opener:allow-open-url'),
  allow: z.array(z.object({ url: z.string() })),
})

/** Files under a directory, recursively. */
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return sourceFiles(full)
    }

    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      return []
    }

    return [full]
  })
}

/** Env names read by the app, the shell, the scripts and the tests. */
function codeEnvNames(): string[] {
  const names = SOURCE_ROOTS.flatMap(sourceFiles).flatMap((source) => {
    const text = fs.readFileSync(source, 'utf8')

    return ENV_READS.flatMap((pattern) => {
      return [...text.matchAll(pattern)].map((match) => {
        return required(match[1], `env read in ${source}`)
      })
    })
  })

  return uniq([...names, ...SECRET_NAMES])
}

/** Env names in the DEVELOPMENT section 8 table. */
function documentedEnvNames(): string[] {
  const rows = tableRows(
    fs.readFileSync(file('docs/DEVELOPMENT.md'), 'utf8'),
    '8. Environment variables',
  )

  return uniq(
    rows.flatMap((cells) => {
      const cell = required(cells[0], 'env name cell')

      return [...cell.matchAll(/[A-Z][A-Z0-9_]+/g)].map((match) => {
        return required(match[0], 'env name')
      })
    }),
  )
}

describe('update timing', () => {
  it('builds the README delay and interval from the constants', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')
    const delaySeconds = bounds.UPDATE_CHECK_DELAY_MS / 1000
    const intervalHours = bounds.UPDATE_CHECK_INTERVAL_MS / 3_600_000

    const expected = `checks ${String(delaySeconds)} seconds after launch, then every ${String(intervalHours)} hours`

    expect(readme).toContain(expected)
  })
})

describe('bounds table', () => {
  it('lists the update and credits constants with their values', () => {
    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '11. Bounds')

    const expected = {
      UPDATE_CHECK_DELAY_MS: bounds.UPDATE_CHECK_DELAY_MS,
      UPDATE_CHECK_INTERVAL_MS: bounds.UPDATE_CHECK_INTERVAL_MS,
      CREDITS_POLL_MS: bounds.CREDITS_POLL_MS,
    }

    for (const [name, value] of Object.entries(expected)) {
      const row = required(
        rows.find((cells) => {
          return cells[0] === name
        }),
        `${name} bounds row`,
      )

      expect(Number(required(row[1], name).replaceAll(',', '')), name).toBe(value)
    }
  })
})

describe('security opener hosts', () => {
  it('names every host allowed by the opener permission', () => {
    const source = fs.readFileSync(file('src-tauri/capabilities/default.json'), 'utf8')
    const capability = CapabilitySchema.parse(JSON.parse(source))

    const opener = required(
      capability.permissions.flatMap((permission) => {
        const parsed = OpenerSchema.safeParse(permission)

        return parsed.success ? [parsed.data] : []
      })[0],
      'opener:allow-open-url',
    )

    const security = fs.readFileSync(file('docs/SECURITY.md'), 'utf8')

    const hosts = uniq(
      opener.allow.map(({ url }) => {
        return new URL(url).hostname
      }),
    )

    expect(isEmpty(hosts)).toBe(false)

    for (const host of hosts) {
      expect(security, host).toContain(host)
    }
  })
})

describe('development env table', () => {
  it('matches the names the code reads in both directions', () => {
    const documented = new Set(documentedEnvNames())
    const read = new Set(codeEnvNames())
    const allowed = new Set([...BUILD_ONLY, ...INTERNAL])

    const unused = [...documented].filter((name) => {
      return !read.has(name) && !allowed.has(name)
    })

    const undocumented = [...read].filter((name) => {
      return !documented.has(name) && !allowed.has(name)
    })

    expect(unused, 'doc rows no code reads').toEqual([])
    expect(undocumented, 'code reads missing from the doc').toEqual([])
  })

  it('has no stale allowlist entries', () => {
    const documented = new Set(documentedEnvNames())
    const read = new Set(codeEnvNames())

    const stale = [...BUILD_ONLY, ...INTERNAL].filter((name) => {
      return !documented.has(name) && !read.has(name)
    })

    expect(stale, 'allowlist names neither read nor documented').toEqual([])
  })
})
