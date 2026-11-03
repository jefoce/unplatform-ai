import fs from 'node:fs'
import path from 'node:path'

import { find, isString } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import * as bounds from '../src/core/constants'
import { isRecord } from '../src/core/guards'
import { VIDEO_PRESETS } from '../src/core/presets'
import { IMAGE_PRESETS } from '../src/core/presets/image'
import { APP_RULES } from '../src/core/provider-errors/app'
import { OPENROUTER_DESCRIPTOR } from '../src/core/providers/openrouter'
import { PROVIDERS, STORAGE_PROVIDERS } from '../src/core/providers/registry'
import { GUIDE_BASE } from '../src/core/providers/types'
import { STATUS_HELP } from '../src/core/status-help'
import type { Dict } from '../src/core/utility-types'
import { file, ROOT, sectionLines, tableRows } from './helpers/docs-tables'
import { imageTargets } from './helpers/image-targets'
import { modelFamily, PRESET_FAMILIES } from './helpers/model-families'
import { required } from './helpers/required'

const DOCS = path.join(ROOT, 'docs')

/** Rule title as text, throwing when the rule builds it from raw text. */
function ruleTitle(title: unknown, label: string): string {
  return required(isString(title) ? title : null, `Rule title for ${label}`)
}

/** Friendly title of the APP_RULES entry that matches the raw text. */
function appTitle(match: string): string {
  const rule = required(find(APP_RULES, { match }), `App rule for ${match}`)

  return ruleTitle(rule.title, match)
}

/** Status labels packed in the first cell of a row, split on `/`. */
function rowLabels(cells: string[]): string[] {
  return required(cells[0], 'label cell')
    .split('/')
    .map((label) => {
      return label.trim()
    })
}

/** Numeric constant as one bounds row. */
function singleValue(name: string, value: unknown): [string, number | string][] {
  return typeof value === 'number' ? [[name, value]] : []
}

/** Numeric fields of a nested constant as dotted bounds rows. */
function nestedValues(name: string, value: object): [string, number][] {
  return Object.entries(value).flatMap(([field, nested]) => {
    return typeof nested === 'number' ? [[`${name}.${field}`, nested]] : []
  })
}

describe('bounds table', () => {
  it('keeps the bounds table equal to the constants', () => {
    const numeric = Object.entries(bounds).flatMap(([name, value]) => {
      return isRecord(value) ? nestedValues(name, value) : singleValue(name, value)
    })

    const expected: Dict<number | string> = Object.fromEntries([
      ...numeric,
      ['VIDEO_PRESETS', 'reference'],
    ])

    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '11. Bounds')

    expect(rows.length).toBe(Object.keys(expected).length)

    for (const row of rows) {
      const name = required(row[0], 'row name')
      const value = required(row[1], 'row value')
      const want = expected[name]

      expect(want, `bounds row not covered: ${name}`).toBeDefined()

      if (name === 'VIDEO_PRESETS') {
        expect(value).toContain('presets/index.ts')
        continue
      }

      expect(Number(value.replaceAll(',', '')), name).toBe(want)
    }
  })
})

describe('documentation tables', () => {
  it('separates the video and image active caps in DEVELOPMENT', () => {
    const text = fs.readFileSync(file('docs/DEVELOPMENT.md'), 'utf8')

    expect(text).toContain('image jobs use `IMAGE_MAX_ACTIVE`')
    expect(text).toContain('Video jobs use `MAX_ACTIVE_JOBS`')
    expect(text).not.toContain('share the `MAX_ACTIVE_JOBS` limit')
  })

  it('keeps the README status table equal to STATUS_HELP', () => {
    const rows = tableRows(fs.readFileSync(file('README.md'), 'utf8'), 'What the statuses mean')

    const labels = Object.values(STATUS_HELP).map((help) => {
      return help.label
    })

    const tableLabels = rows.flatMap(rowLabels)

    for (const cells of rows) {
      expect(cells.length, cells[0]).toBe(3)
    }

    expect(new Set(tableLabels)).toEqual(new Set(labels))

    for (const label of tableLabels) {
      expect(labels, `status not in STATUS_HELP: ${label}`).toContain(label)
    }
  })

  it('keeps the architecture models table equal to the presets', () => {
    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '7. Presets')

    expect(rows.length).toBe(VIDEO_PRESETS.length)

    for (const [title, duration, resolutions, references] of rows) {
      const preset = VIDEO_PRESETS.find((item) => {
        return item.title === title
      })

      if (!preset) {
        throw new Error(`Unknown model: ${title}`)
      }

      expect(duration, title).toBe(`${preset.duration.min}-${preset.duration.max} s`)
      expect(resolutions, title).toBe(preset.resolutions.join(', '))

      expect(references, title).toBe(
        `${preset.references.image} / ${preset.references.video} / ${preset.references.audio}`,
      )
    }
  })

  it('keeps the README model list on every preset family', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')

    const bullets = sectionLines(readme, 'Models').filter((line) => {
      return line.startsWith('- ')
    })

    const families = new Set(
      [...VIDEO_PRESETS, ...IMAGE_PRESETS].map((preset) => {
        const family = required(PRESET_FAMILIES[preset.title], `Family for ${preset.title}`)

        expect(family, preset.title).toBe(modelFamily(preset.title))

        return family
      }),
    )

    const listed = new Set(
      bullets.map((line) => {
        const first = required(line.slice(2).split('/')[0], 'model bullet').trim()

        return modelFamily(first)
      }),
    )

    expect(listed).toEqual(families)
  })
})

describe('user guides', () => {
  it('keeps every guide image on disk', () => {
    const files = [
      'README.md',
      ...fs.readdirSync(path.join(DOCS, 'user')).map((name) => {
        return path.join('docs', 'user', name)
      }),
    ]

    for (const rel of files) {
      for (const target of imageTargets(fs.readFileSync(file(rel), 'utf8'))) {
        const resolved = path.resolve(path.dirname(file(rel)), target)

        expect(fs.existsSync(resolved), `${rel} -> ${target}`).toBe(true)
      }
    }
  })

  it('links the README and the app to both guides', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')

    for (const rel of ['docs/user/OPENROUTER.md', 'docs/user/CLOUDFLARE-R2.md']) {
      expect(readme).toContain(`](${rel})`)
      expect(fs.existsSync(file(rel)), rel).toBe(true)
    }

    for (const descriptor of [...PROVIDERS, ...STORAGE_PROVIDERS]) {
      const link = required(
        descriptor.links.find((candidate) => {
          return candidate.label === 'Setup guide'
        }),
        `Setup guide link for ${descriptor.id}`,
      )

      const rel = link.url.slice(`${GUIDE_BASE}/`.length)

      expect(link.url.startsWith(GUIDE_BASE), descriptor.id).toBe(true)
      expect(fs.existsSync(path.join(DOCS, 'user', rel)), link.url).toBe(true)
    }
  })

  it('keeps the R2 guide numbers equal to the constants', () => {
    const guide = fs.readFileSync(file('docs/user/CLOUDFLARE-R2.md'), 'utf8')

    expect(guide).toContain(`${String(bounds.REMOTE_MAX_GB)} GB`)
    expect(guide).toContain(`${String(bounds.REMOTE_FREE_GB)} GB`)
    expect(guide).toContain(`${String(bounds.REMOTE_UNUSED_DAYS)} days`)
    expect(guide).toContain(`${String(bounds.REMOTE_LINK_TTL_SEC / 3600)} hours`)
  })

  it('quotes the app strings in the guides', () => {
    const openrouter = fs.readFileSync(file('docs/user/OPENROUTER.md'), 'utf8')
    const r2 = fs.readFileSync(file('docs/user/CLOUDFLARE-R2.md'), 'utf8')
    const readme = fs.readFileSync(file('README.md'), 'utf8')
    const unauthorized = required(OPENROUTER_DESCRIPTOR.httpRules[401], '401 rule')
    const insufficient = required(OPENROUTER_DESCRIPTOR.httpRules[402], '402 rule')

    expect(openrouter).toContain(ruleTitle(unauthorized.title, '401'))
    expect(openrouter).toContain(ruleTitle(insufficient.title, '402'))
    expect(r2).toContain(appTitle("R2 is at the app's"))
    expect(readme).toContain(appTitle('key is not set'))
    expect(readme).toContain(ruleTitle(unauthorized.title, '401'))
    expect(readme).toContain(appTitle("R2 is at the app's"))
    expect(readme).not.toContain("R2 is at the app's")
  })
})

describe('storage and code maps', () => {
  it('lists every storage folder in the README', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')

    for (const folder of ['downloads', 'images', 'uploads', 'data', '.cache', 'runtime']) {
      expect(readme, folder).toContain(`- \`${folder}\``)
    }
  })

  it('names the image and core modules in the architecture map', () => {
    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '2. Code map')

    const names = rows.map((cells) => {
      return required(cells[0], 'map path')
    })

    const expected = [
      'src/core/pricing',
      'src/core/media',
      'src/core/feed',
      'src/core/api',
      'src/server/jobs',
      'src/server/services',
      'src/server/repos',
      'src/features/image-generator',
    ]

    for (const name of expected) {
      expect(names, name).toContain(name)
    }
  })
})

describe('documentation text', () => {
  it('explains the data folder move', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8')

    expect(readme).toContain('0.3.2 bridge')
    expect(readme).toContain('The data folder used by 0.3.x')
    expect(readme).toContain('.unplatform-ai')
    expect(readme).toContain('does not read the old one')
  })

  it('keeps the affiliation disclaimer', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8').replaceAll(/\s+/g, ' ')

    expect(readme).toContain('Not affiliated with any commercial AI video platform.')
  })

  it('has no broken relative links', () => {
    const files = [
      'README.md',
      ...fs
        .readdirSync(DOCS)
        .filter((name) => {
          return name.endsWith('.md')
        })
        .map((name) => {
          return path.join('docs', name)
        }),
    ]

    for (const rel of files) {
      const source = fs.readFileSync(file(rel), 'utf8')

      for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = required(match[1], 'link target')

        if (/^(https?:|mailto:|#)/.test(target)) {
          continue
        }

        const clean = target.split(/[#?]/)[0] ?? ''

        if (clean === '') {
          continue
        }

        const resolved = path.resolve(path.dirname(file(rel)), clean)

        expect(fs.existsSync(resolved), `${rel} -> ${target}`).toBe(true)
      }
    }
  })
})
