import fs from 'node:fs'
import path from 'node:path'

import { isEmpty, isNil } from 'lodash-es'
import { describe, expect, it } from 'vitest'

const WORKFLOW = '.github/workflows/release.yml'

/** One top-level job block, from its key to the next job key. */
function jobBlock(text: string, job: string): string {
  const lines = text.split(/\r?\n/)

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

/** Job name to its job-level timeout in minutes, when declared. */
function jobTimeouts(text: string): Record<string, number> {
  const timeouts: Record<string, number> = {}
  let job = ''

  for (const line of text.split(/\r?\n/)) {
    const header = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)

    if (header) {
      job = header[1] ?? ''
      continue
    }

    const timeout = /^ {4}timeout-minutes:\s*(\d+)\s*$/.exec(line)

    if (!isEmpty(job) && !isNil(timeout)) {
      timeouts[job] = Number(timeout[1])
    }
  }

  return timeouts
}

describe('release build job', () => {
  const text = fs.readFileSync(path.resolve(WORKFLOW), 'utf8')
  const build = jobBlock(text, 'build')
  const fetched = build.indexOf('cargo fetch --locked --manifest-path src-tauri/Cargo.toml')
  const notices = build.indexOf('run: pnpm notices')
  const tested = build.indexOf('cargo test --manifest-path src-tauri/Cargo.toml')
  const staged = build.indexOf('name: Stage server')
  const built = build.indexOf('pnpm tauri build')

  it('tests Rust inside the matrix build job', () => {
    expect(build).toContain('matrix:')
    expect(tested).toBeGreaterThan(-1)
  })

  it('fetches cargo sources and runs notices before cargo test', () => {
    expect(fetched).toBeGreaterThan(-1)
    expect(notices).toBeGreaterThan(fetched)
    expect(tested).toBeGreaterThan(notices)
  })

  it('runs cargo test before staging the server', () => {
    expect(staged).toBeGreaterThan(-1)
    expect(tested).toBeLessThan(staged)
  })

  it('smokes the built app on macOS', () => {
    const smoke = build.indexOf('SMOKE_APP:')

    expect(smoke).toBeGreaterThan(built)

    expect(build.slice(smoke, smoke + 120)).toContain(
      'src-tauri/target/${{ matrix.target }}/release/bundle/macos/Unplatform AI.app',
    )
  })

  it('smokes the staged server on Windows and Linux', () => {
    expect(build).toContain("if: runner.os != 'macOS'")
    expect(build).toContain('SMOKE_STAGED=1 pnpm smoke')
  })
})

describe('release workflow timeouts', () => {
  const text = fs.readFileSync(path.resolve(WORKFLOW), 'utf8')

  it('gives only the node job a longer timeout', () => {
    expect(jobTimeouts(text)).toEqual({
      version: 5,
      draft: 5,
      ffmpeg: 90,
      node: 330,
      build: 120,
      checksums: 10,
      'updater-manifest': 10,
      tag: 5,
    })
  })
})
