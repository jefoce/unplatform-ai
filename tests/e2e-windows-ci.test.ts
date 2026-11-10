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
