#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ALLOWLIST = path.join('.github', 'old-names-allowlist.txt')
const CHECKS = [
  ['old product name', new RegExp(['cheap', 'field'].join(''), 'i')],
  ['old folder name', new RegExp(['hig', 'gs', 'field'].join(''), 'i')],
  ['provider env prefix', new RegExp(`\\b${['C', 'F', '_'].join('')}[A-Z_]+`)],
  ['old build flag', new RegExp(['cf', '-', 'build'].join(''))],
  ['old session key', new RegExp(['cf', '_', 'session'].join(''))],
  ['internal state prefix', new RegExp(['_', '_', 'cf', '_'].join(''))],
  ['secrets bridge prefix', new RegExp(['@', '@', 'cf', '-'].join(''))],
]

/** Repo-relative paths from the allowlist, comments and blanks skipped. */
async function readAllowlist() {
  const text = await fs.readFile(path.join(ROOT, ALLOWLIST), 'utf8')
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#')),
  )
}

/** Every tracked path, NUL separated so spaces survive. */
function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  return output.split('\0').filter(Boolean)
}

/** Every line of a file that matches one of the checks. */
async function findMatches(file) {
  const text = await fs.readFile(path.join(ROOT, file), 'utf8')
  const matches = []
  text.split(/\r?\n/).forEach((line, index) => {
    for (const [label, regex] of CHECKS) {
      if (regex.test(line)) matches.push(`${file}:${index + 1}: ${label}: ${line.trim()}`)
    }
  })
  return matches
}

async function main() {
  const allowed = await readAllowlist()
  const failures = []

  for (const file of trackedFiles()) {
    if (allowed.has(file)) continue
    failures.push(...(await findMatches(file)))
  }

  if (failures.length === 0) {
    console.log('[check-old-names] no old names in tracked files')
    return
  }

  console.error(failures.join('\n'))
  console.error(`[check-old-names] ${failures.length} old name(s) found`)
  process.exit(1)
}

await main()
