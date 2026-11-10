import fs from 'node:fs'

import { describe, expect, it } from 'vitest'

const WORKFLOW = '.github/workflows/checks.yml'
const SERVER = 'tests/e2e/lib/server.mjs'

function jobBlock(name: string): string {
  const lines = fs.readFileSync(WORKFLOW, 'utf8').split('\n')

  const start = lines.findIndex((line) => {
    return line === `  ${name}:`
  })

  if (start === -1) {
    throw new Error(`No ${name} job`)
  }

  const next = lines.findIndex((line, index) => {
    return index > start && /^  \S/.test(line)
  })

  const end = next === -1 ? lines.length : next

  return lines.slice(start, end).join('\n')
}

function stepBlock(job: string, name: string): string {
  const lines = job.split('\n')

  const start = lines.findIndex((line) => {
    return line === `      - name: ${name}`
  })

  if (start === -1) {
    throw new Error(`No ${name} step`)
  }

  const next = lines.findIndex((line, index) => {
    return index > start && line.startsWith('      - ')
  })

  const end = next === -1 ? lines.length : next

  return lines.slice(start, end).join('\n')
}

describe('linux e2e shards', () => {
  const job = jobBlock('e2e')
  const run = stepBlock(job, 'End-to-end flows')
  const upload = stepBlock(job, 'Upload failure artifacts')
  const docs = fs.readFileSync('docs/DEVELOPMENT.md', 'utf8')

  it('names the job after the width', () => {
    expect(job).toContain('name: e2e (${{ matrix.width }})')
  })

  it('runs all three widths without fail-fast', () => {
    expect(job).toContain('width: [1280, 1728, 2560]')
    expect(job).toContain('fail-fast: false')
  })

  it('times out after 25 minutes', () => {
    expect(job).toContain('timeout-minutes: 25')
  })

  it('runs one width through bash', () => {
    expect(run).toContain('shell: bash')
    expect(run).toContain('run: node tests/e2e/run.mjs --width=${{ matrix.width }}')
    expect(run).toContain('E2E_TMPDIR: ${{ runner.temp }}/e2e-${{ matrix.width }}')
  })

  it('uploads the temp dir and log on failure', () => {
    expect(upload).toContain('if: failure()')
    expect(upload).toContain('name: e2e-${{ matrix.width }}')
    expect(upload).toContain('${{ runner.temp }}/e2e-${{ matrix.width }}.log')
  })

  it('documents the three shard names', () => {
    expect(docs).toContain('e2e (1280)')
    expect(docs).toContain('e2e (1728)')
    expect(docs).toContain('e2e (2560)')
    expect(docs).toContain('e2e-<width>')
  })
})

describe('e2e-windows image case', () => {
  const step = stepBlock(jobBlock('e2e-windows'), 'Image first open')

  it('runs under bash', () => {
    expect(step).toContain('shell: bash')
  })

  it('runs the e2e script directly', () => {
    expect(step).toContain('run: node tests/e2e/run.mjs --case=image-first')
  })
})

describe('e2e server start command', () => {
  const source = fs.readFileSync(SERVER, 'utf8')

  it('does not start through a shell', () => {
    expect(source).not.toContain("shell: process.platform === 'win32'")
  })

  it('resolves the start command without a shell', () => {
    expect(source).toContain('process.env.npm_execpath')
    expect(source).toContain('process.env.ComSpec')
  })
})
