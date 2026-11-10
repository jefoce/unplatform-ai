/* eslint-disable max-lines -- drift checks share one documentation suite */

import fs from 'node:fs'
import path from 'node:path'

import { isEmpty, uniq } from 'lodash-es'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import * as bounds from '../src/core/constants'
import { SECRET_NAMES } from '../src/core/secret-names'
import { STATUS_HELP } from '../src/core/status-help'
import { file, sectionLines, tableRows } from './helpers/docs-tables'
import { required } from './helpers/required'

const SOURCE_ROOTS = ['src', 'src-tauri/src', 'scripts', 'tests']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.rs'])

const ENV_READS = [
  /\bprocess\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
  /process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g,
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
  'UPAI_BUILD_WORK_DIR',
  'CARGO_TARGET_DIR',
])

/** Framework, runtime and injected names that are not user-facing app config. */
const INTERNAL = new Set([
  'APPIMAGE',
  'HOSTNAME',
  'HOME',
  'USERPROFILE',
  'UPAI_REAL_HOME',
  'UPAI_PACK_ROOT',
  'VITEST_WORKER_ID',
  'NEXT_PUBLIC_APP_VERSION',
  'NEXT_RUNTIME',
  'NODE_ENV',
  'CHROME_PATH',
  'E2E_CHROME_MAJOR',
  'E2E_CDP_PORT',
  'E2E_KEEP_TMP',
  'E2E_SKIP_BUILD',
  'E2E_TMPDIR',
  'PATH',
])

const CapabilitySchema = z.object({
  permissions: z.array(z.unknown()),
})

const OpenerSchema = z.object({
  identifier: z.literal('opener:allow-open-url'),
  allow: z.array(z.object({ url: z.string() })),
})

const OpenPathSchema = z.object({
  identifier: z.literal('opener:allow-open-path'),
  allow: z.array(z.object({ path: z.string() })),
})

/** Paths allowed by the opener:allow-open-path permission. */
function openerPaths(text: string): string[] {
  const capability = CapabilitySchema.parse(JSON.parse(text))

  const opener = required(
    capability.permissions.flatMap((permission) => {
      const parsed = OpenPathSchema.safeParse(permission)

      return parsed.success ? [parsed.data] : []
    })[0],
    'opener:allow-open-path',
  )

  return opener.allow.map(({ path: openerPath }) => {
    return openerPath
  })
}

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

describe('0.5.0 documentation drift', () => {
  it('describes removing an endpoint before Save', () => {
    const guide = fs.readFileSync(file('docs/user/COMFYUI.md'), 'utf8')
    const section = sectionLines(guide, 'Delete an endpoint').join('\n')

    expect(section).toContain('removed.')
    expect(section).toContain('Undo')
    expect(section).toContain('Save')
    expect(section).toContain('This endpoint was removed.')
    expect(section).not.toContain('Will be removed')
  })

  it('quotes the ComfyUI queue labels and keeps progress video-only', () => {
    const changelog = fs.readFileSync(file('CHANGELOG.md'), 'utf8')

    expect(changelog).toContain(STATUS_HELP.waiting_comfyui.label)
    expect(changelog).toContain(STATUS_HELP.queued_n.label)

    const imageProgress = changelog.split(/\r?\n/).filter((line) => {
      return /progress percent/i.test(line) && /image/i.test(line)
    })

    expect(imageProgress).toEqual([])
  })

  it('documents the bundled opener files and the error command', () => {
    const security = fs.readFileSync(file('docs/SECURITY.md'), 'utf8')

    const defaultPaths = openerPaths(
      fs.readFileSync(file('src-tauri/capabilities/default.json'), 'utf8'),
    )

    const remotePaths = openerPaths(
      fs.readFileSync(file('src-tauri/capability-remote.json'), 'utf8'),
    )

    for (const openerPath of ['$RESOURCE/THIRD_PARTY_NOTICES.md', '$RESOURCE/LICENSE']) {
      expect(security, openerPath).toContain(openerPath)
      expect(defaultPaths, openerPath).toContain(openerPath)
      expect(remotePaths, openerPath).toContain(openerPath)
    }

    expect(security).toContain('log_client_error')
  })

  it('does not claim image records carry progress', () => {
    const lines = fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8').split(/\r?\n/)

    const start = lines.findIndex((line) => {
      return line.startsWith('### ImageRecord')
    })

    expect(start).toBeGreaterThan(-1)

    const rest = lines.slice(start + 1)

    const end = rest.findIndex((line) => {
      return line.startsWith('### ') || line.startsWith('## ')
    })

    const section = (end === -1 ? rest : rest.slice(0, end)).join('\n')

    expect(section).not.toContain('progress')
  })

  it('drops the stripped endpoints version and keeps the loose fields right', () => {
    const architecture = fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8')
    const decisions = fs.readFileSync(file('docs/DECISIONS.md'), 'utf8')

    expect(architecture).not.toContain('| `version` | File format version')
    expect(decisions).not.toContain('holds `version`, `endpoints`')

    expect(architecture).toContain('| `presetSnapshot` | Loose preset copy: id, title, family |')
    expect(decisions).toContain('`presetSnapshot` stores only `id`, `title`, `family`')

    expect(architecture).toContain('| `progress` | Percent, queue position and waiting reason |')
    expect(architecture).not.toMatch(/\| `progress` \|[^\n]*node/)
  })

  it('links the node pack and the ComfyUI guide in the README', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')

    expect(readme).toContain(
      '[Unplatform AI node pack](https://github.com/jefoce/unplatform-ai-provider-node)',
    )

    expect(readme).toContain('](docs/user/COMFYUI.md)')
  })
})

describe('ComfyUI guide hero and pack links', () => {
  const PACK = 'https://github.com/jefoce/unplatform-ai-provider-node'

  it('shows the hero image from the pack', () => {
    const guide = fs.readFileSync(file('docs/user/COMFYUI.md'), 'utf8')

    expect(guide).toContain('<img src="../images/comfyui-hero.svg"')
    expect(fs.existsSync(file('docs/images/comfyui-hero.svg'))).toBe(true)
  })

  it('points at ComfyUI Manager and the pack guides', () => {
    const guide = fs.readFileSync(file('docs/user/COMFYUI.md'), 'utf8')

    expect(guide).toContain('ComfyUI Manager')
    expect(guide).toContain('Unplatform AI Provider')

    for (const target of [
      `${PACK}/tree/HEAD/workflows`,
      `${PACK}/blob/HEAD/docs/user/build-a-workflow.md`,
      `${PACK}/blob/HEAD/docs/user/network.md`,
      `${PACK}/blob/HEAD/docs/user/memory.md`,
      `${PACK}/blob/HEAD/docs/user/troubleshooting.md`,
      `${PACK}/blob/HEAD/docs/user/faq.md`,
    ]) {
      expect(guide, target).toContain(target)
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
