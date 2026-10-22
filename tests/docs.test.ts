import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as bounds from '@/core/constants'
import { MODEL_PRESETS } from '@/core/presets'
import { STATUS_HELP } from '@/core/status-help'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DOCS = path.join(ROOT, 'docs')

/** Rows of a markdown section's table, header excluded. */
function tableRows(markdown: string, heading: string): string[][] {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`)

  if (start === -1) throw new Error(`Missing section: ${heading}`)

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n')

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim().replaceAll('`', '')),
    )
    .filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
    .slice(1)
}

const file = (rel: string) => path.join(ROOT, rel)

/** Status labels packed in the first cell of a row, split on `/`. */
function rowLabels(cells: string[]): string[] {
  return cells[0].split('/').map((label) => label.trim())
}

describe('bounds table', () => {
  it('keeps the bounds table equal to the constants', () => {
    const expected: Record<string, number | string> = {
      MAX_ACTIVE_JOBS: bounds.MAX_ACTIVE_JOBS,
      MAX_REQUEST_MB: bounds.MAX_REQUEST_MB,
      MAX_INLINE_MEDIA_MB: bounds.MAX_INLINE_MEDIA_MB,
      MAX_IDS: bounds.MAX_IDS,
      SUBMIT_GRACE_MS: bounds.SUBMIT_GRACE_MS,
      GRACE_STALE_MS: bounds.GRACE_STALE_MS,
      SHUTDOWN_SEND_WAIT_MS: bounds.SHUTDOWN_SEND_WAIT_MS,
      POLL_INTERVAL_MS: bounds.POLL_INTERVAL_MS,
      HISTORY_POLL_MS: bounds.HISTORY_POLL_MS,
      MAX_JOB_AGE_MIN: bounds.MAX_JOB_AGE_MIN,
      MAX_DOWNLOAD_RETRIES: bounds.MAX_DOWNLOAD_RETRIES,
      'FETCH_TIMEOUTS.submit': bounds.FETCH_TIMEOUTS.submit,
      'FETCH_TIMEOUTS.poll': bounds.FETCH_TIMEOUTS.poll,
      'FETCH_TIMEOUTS.content': bounds.FETCH_TIMEOUTS.content,
      'FETCH_TIMEOUTS.meta': bounds.FETCH_TIMEOUTS.meta,
      REMOTE_LINK_TTL_SEC: bounds.REMOTE_LINK_TTL_SEC,
      REMOTE_UNUSED_DAYS: bounds.REMOTE_UNUSED_DAYS,
      UPLOAD_CLEANUP_MS: bounds.UPLOAD_CLEANUP_MS,
      THUMB_WIDTH: bounds.THUMB_WIDTH,
      PREVIEW_WIDTH: bounds.PREVIEW_WIDTH,
      SEED_MAX: bounds.SEED_MAX,
      MODEL_PRESETS: 'reference',
    }

    const rows = tableRows(fs.readFileSync(file('docs/ARCHITECTURE.md'), 'utf8'), '11. Bounds')

    expect(rows.length).toBe(Object.keys(expected).length)

    for (const [name, value] of rows) {
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
    const labels = Object.values(STATUS_HELP).map((help) => help.label)
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
      const preset = MODEL_PRESETS.find((item) => item.title === title)

      if (!preset) throw new Error(`Unknown model: ${title}`)

      expect(duration, title).toBe(`${preset.duration.min}-${preset.duration.max} s`)
      expect(resolutions, title).toBe(preset.resolutions.join(', '))
      expect(references, title).toBe(
        `${preset.references.image} / ${preset.references.video} / ${preset.references.audio}`,
      )
    }
  })

  it('keeps the Unplatform trademark disclaimer', () => {
    const readme = fs.readFileSync(file('README.md'), 'utf8').replaceAll(/\s+/g, ' ')
    const disclaimer =
      '"Unplatform" is a trademark of its respective owner. This project is independent and is not affiliated with, sponsored by, or endorsed by Unplatform AI. The name is used only to describe this app as an alternative.'

    expect(readme).toContain(disclaimer)
  })

  it('has no broken relative links', () => {
    const files = [
      'README.md',
      ...fs
        .readdirSync(DOCS)
        .filter((name) => name.endsWith('.md'))
        .map((name) => path.join('docs', name)),
    ]

    for (const rel of files) {
      const source = fs.readFileSync(file(rel), 'utf8')

      for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = match[1]

        if (/^(https?:|mailto:|#)/.test(target)) continue

        const clean = target.split('#')[0].split('?')[0]

        if (clean === '') continue

        const resolved = path.resolve(path.dirname(file(rel)), clean)

        expect(fs.existsSync(resolved), `${rel} -> ${target}`).toBe(true)
      }
    }
  })
})
