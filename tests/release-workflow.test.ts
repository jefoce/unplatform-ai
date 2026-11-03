import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const WORKFLOW = '.github/workflows/release.yml'

/** One top-level job block, from its key to the next job key. */
function jobBlock(text: string, job: string): string {
  const lines = text.split('\n')

  const start = lines.findIndex((line) => {
    return line === `  ${job}:`
  })

  if (start === -1) {
    throw new Error(`job ${job} not found in ${WORKFLOW}`)
  }

  const rest = lines.slice(start + 1)

  const end = rest.findIndex((line) => {
    return /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line)
  })

  return end === -1 ? rest.join('\n') : rest.slice(0, end).join('\n')
}

describe('release build job', () => {
  const text = fs.readFileSync(path.resolve(WORKFLOW), 'utf8')
  const build = jobBlock(text, 'build')
  const staged = build.indexOf('name: Stage server')
  const tested = build.indexOf('cargo test --manifest-path src-tauri/Cargo.toml')

  it('tests Rust inside the matrix build job', () => {
    expect(build).toContain('matrix:')
    expect(tested).toBeGreaterThan(-1)
  })

  it('runs cargo test after the server is staged', () => {
    expect(staged).toBeGreaterThan(-1)
    expect(tested).toBeGreaterThan(staged)
  })
})
