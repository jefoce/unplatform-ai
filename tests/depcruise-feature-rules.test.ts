import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

interface Rule {
  name: string
}

interface CruiserConfig {
  forbidden: Rule[]
}

interface Violation {
  rule: Rule
}

interface CruiseReport {
  summary: { violations: Violation[] }
}

interface Fixture {
  rule: string
  from: string
  to: string
}

const require = createRequire(import.meta.url)

const config = require('../.dependency-cruiser.cjs') as CruiserConfig

const DEPCRUISE = path.join(process.cwd(), 'node_modules/.bin/dependency-cruiser')

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-depcruise-'))
const FEATURES = path.join(ROOT, 'src/features')

const FORBIDDEN: Fixture[] = [
  { rule: 'workspace-direction', from: 'workspace', to: 'image-generator' },
  { rule: 'viewers-direction', from: 'viewers', to: 'history' },
  { rule: 'image-generator-direction', from: 'image-generator', to: 'history' },
  { rule: 'media-input-direction', from: 'media-input', to: 'preview' },
]

const ALLOWED: Fixture[] = [
  { rule: 'workspace-direction', from: 'workspace', to: 'generator' },
  { rule: 'viewers-direction', from: 'viewers', to: 'preview' },
  { rule: 'image-generator-direction', from: 'image-generator', to: 'media-picker' },
  { rule: 'media-input-direction', from: 'media-input', to: 'image-generator' },
]

function writeFeature(name: string): void {
  const dir = path.join(FEATURES, name)

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.ts'), `export const ${name.replaceAll('-', '_')} = 1\n`)
}

function writeImport(fixture: Fixture, kind: string): void {
  const file = path.join(FEATURES, fixture.from, `${kind}.ts`)

  fs.writeFileSync(
    file,
    `import { target } from '../${fixture.to}/index'\n\nexport const ${kind} = target\n`,
  )
}

describe('feature dependency rules', () => {
  it('flags each forbidden feature import and allows the listed ones', () => {
    const fromFeatures = new Set(
      [...FORBIDDEN, ...ALLOWED].map((item) => {
        return item.from
      }),
    )

    const toFeatures = new Set(
      [...FORBIDDEN, ...ALLOWED].map((item) => {
        return item.to
      }),
    )

    for (const name of fromFeatures) {
      writeFeature(name)
    }

    for (const name of toFeatures) {
      writeFeature(name)
    }

    for (const fixture of FORBIDDEN) {
      writeImport(fixture, 'forbidden')
    }

    for (const fixture of ALLOWED) {
      writeImport(fixture, 'allowed')
    }

    const ruleNames = new Set(
      [...FORBIDDEN, ...ALLOWED].map((item) => {
        return item.rule
      }),
    )

    const fixtureConfig = {
      forbidden: config.forbidden.filter((rule) => {
        return ruleNames.has(rule.name)
      }),
      options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true },
    }

    const configPath = path.join(ROOT, 'dependency-cruiser.json')

    fs.writeFileSync(configPath, JSON.stringify(fixtureConfig))

    const result = spawnSync(
      process.execPath,
      [DEPCRUISE, 'src', '--config', configPath, '--output-type', 'json'],
      { cwd: ROOT, encoding: 'utf8' },
    )

    const report = JSON.parse(result.stdout) as CruiseReport

    const fired = report.summary.violations.map((violation) => {
      return violation.rule.name
    })

    expect(fired.sort()).toEqual(
      FORBIDDEN.map((fixture) => {
        return fixture.rule
      }).sort(),
    )
  })
})
