import fs from 'node:fs'
import path from 'node:path'

import { find, isString } from 'lodash-es'
import { describe, expect, it } from 'vitest'

import * as bounds from '@/core/constants'
import { MODEL_PRESETS } from '@/core/presets'
import { APP_RULES } from '@/core/provider-errors/app'
import { OPENROUTER_DESCRIPTOR } from '@/core/providers/openrouter'
import { STORAGE_PROVIDERS, VIDEO_PROVIDERS } from '@/core/providers/registry'
import { GUIDE_BASE } from '@/core/providers/types'
import { STATUS_HELP } from '@/core/status-help'
import type { Dict } from '@/core/utility-types'

import { file, ROOT, tableRows } from './helpers/docs-tables'
import { imageTargets } from './helpers/image-targets'
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

describe('bounds table', () => {
  it('keeps the bounds table equal to the constants', () => {
    const expected: Dict<number | string> = {
      MAX_ACTIVE_JOBS: bounds.MAX_ACTIVE_JOBS,
      MAX_REQUEST_MB: bounds.MAX_REQUEST_MB,
      MAX_INLINE_MEDIA_MB: bounds.MAX_INLINE_MEDIA_MB,
      MAX_IDS: bounds.MAX_IDS,
      SUBMIT_GRACE_MS: bounds.SUBMIT_GRACE_MS,
      GRACE_STALE_MS: bounds.GRACE_STALE_MS,
      SHUTDOWN_SEND_WAIT_MS: bounds.SHUTDOWN_SEND_WAIT_MS,
      POLL_INTERVAL_MS: bounds.POLL_INTERVAL_MS,
      HISTORY_POLL_MS: bounds.HISTORY_POLL_MS,
      CREDITS_POLL_MS: bounds.CREDITS_POLL_MS,
      UPDATE_CHECK_DELAY_MS: bounds.UPDATE_CHECK_DELAY_MS,
      UPDATE_CHECK_INTERVAL_MS: bounds.UPDATE_CHECK_INTERVAL_MS,
      MAX_JOB_AGE_MIN: bounds.MAX_JOB_AGE_MIN,
      MAX_DOWNLOAD_RETRIES: bounds.MAX_DOWNLOAD_RETRIES,
      'FETCH_TIMEOUTS.submit': bounds.FETCH_TIMEOUTS.submit,
      'FETCH_TIMEOUTS.poll': bounds.FETCH_TIMEOUTS.poll,
      'FETCH_TIMEOUTS.content': bounds.FETCH_TIMEOUTS.content,
      'FETCH_TIMEOUTS.meta': bounds.FETCH_TIMEOUTS.meta,
      REMOTE_LINK_TTL_SEC: bounds.REMOTE_LINK_TTL_SEC,
      REMOTE_UNUSED_DAYS: bounds.REMOTE_UNUSED_DAYS,
      REMOTE_FREE_GB: bounds.REMOTE_FREE_GB,
      REMOTE_MAX_GB: bounds.REMOTE_MAX_GB,
      UPLOAD_CLEANUP_MS: bounds.UPLOAD_CLEANUP_MS,
      THUMB_WIDTH: bounds.THUMB_WIDTH,
      PREVIEW_WIDTH: bounds.PREVIEW_WIDTH,
      SEED_MAX: bounds.SEED_MAX,
      MODEL_PRESETS: 'reference',
    }

    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '11. Bounds')

    expect(rows.length).toBe(Object.keys(expected).length)

    for (const row of rows) {
      const name = required(row[0], 'row name')
      const value = required(row[1], 'row value')
      const want = expected[name]

      expect(want, `bounds row not covered: ${name}`).toBeDefined()

      if (name === 'MODEL_PRESETS') {
        expect(value).toContain('presets/index.ts')
        continue
      }

      expect(Number(value.replaceAll(',', '')), name).toBe(want)
    }
  })
})

describe('documentation tables', () => {
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

    expect(rows.length).toBe(MODEL_PRESETS.length)

    for (const [title, duration, resolutions, references] of rows) {
      const preset = MODEL_PRESETS.find((item) => {
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

    for (const descriptor of [...VIDEO_PROVIDERS, ...STORAGE_PROVIDERS]) {
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

describe('documentation text', () => {
  it('keeps the affiliation disclaimer'), () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8').replaceAll(/\s+/g, ' ')

    const disclaimer =
      'Not affiliated with any commercial AI video platform.'

    expect(readme).toContain(disclaimer)
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
