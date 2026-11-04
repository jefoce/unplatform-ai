import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FETCH_TIMEOUTS,
  IMAGE_COUNT_MAX,
  IMAGE_SUBMIT_PARALLEL,
  SHUTDOWN_DOWNLOAD_WAIT_MS,
  SHUTDOWN_IMAGE_WAIT_MS,
  SHUTDOWN_SEND_WAIT_MS,
  SUBMIT_QUEUE_CONCURRENCY,
} from '../src/core/constants'

describe('shutdown send wait', () => {
  it('outlasts the submit timeout so a billed send can finish', () => {
    expect(SHUTDOWN_SEND_WAIT_MS).toBeGreaterThan(FETCH_TIMEOUTS.submit)
  })

  it('covers every image call wave for every queued record plus a save margin', () => {
    const waves = Math.ceil(IMAGE_COUNT_MAX / IMAGE_SUBMIT_PARALLEL)

    expect(SHUTDOWN_IMAGE_WAIT_MS).toBe(
      SUBMIT_QUEUE_CONCURRENCY * waves * (FETCH_TIMEOUTS.submit + 5_000),
    )

    expect(SHUTDOWN_IMAGE_WAIT_MS).toBeGreaterThan(SHUTDOWN_SEND_WAIT_MS)
  })

  it('keeps the generated Rust wait equal to the TS waits', () => {
    const result = execFileSync(process.execPath, ['scripts/shutdown-waits.mjs', '--check'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })

    expect(result).toContain('Rust waits match')
  })

  it('never lets the shell wait be shorter than a download or image wait', () => {
    const rust = fs.readFileSync(path.resolve('src-tauri/src/server/shutdown_waits.rs'), 'utf8')

    const value = (name: string): number => {
      const match = rust.match(new RegExp(`${name}: u64 = (\\d+);`))

      return Number(match?.[1])
    }

    expect(value('WORK_WAIT_MS')).toBeGreaterThanOrEqual(SHUTDOWN_DOWNLOAD_WAIT_MS)
    expect(value('WORK_WAIT_MS')).toBeGreaterThanOrEqual(SHUTDOWN_IMAGE_WAIT_MS)
  })
})
