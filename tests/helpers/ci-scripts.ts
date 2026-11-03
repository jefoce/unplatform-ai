import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { isNil } from 'lodash-es'

const CHECKOUT_REFERENCE = /uses:\s*actions\/checkout@/
const REPO_REFERENCE = /\.github\/(?:scripts|actions)\/|(?<!\.github\/)scripts\//
const JOB_START = /^ {2}([A-Za-z0-9_-]+):\s*$/gm
const STEPS_KEY = /^ {4}steps:\s*$/

const SCRIPTS = path.resolve('.github/scripts')
const tempDirs: string[] = []

export interface RunParams {
  script: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export function runScript(params: RunParams) {
  const { script, args = [], cwd = process.cwd(), env = process.env } = params

  return spawnSync('bash', [path.join(SCRIPTS, script), ...args], {
    cwd,
    env,
    encoding: 'utf8',
  })
}

export function runNodeScript(params: RunParams) {
  const { script, args = [], cwd = process.cwd(), env = process.env } = params

  return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    cwd,
    env,
    encoding: 'utf8',
  })
}

export function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ci-'))

  tempDirs.push(dir)

  return dir
}

export function cleanupTempDirs() {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export function writeFiles(root: string, files: string[]) {
  fs.mkdirSync(root, { recursive: true })

  for (const name of files) {
    fs.writeFileSync(path.join(root, name), name)
  }
}

export function gitRepo(subject: string) {
  const root = tempDir()

  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.2.0"}\n')
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'ci@example.com'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'CI'], { cwd: root })
  execFileSync('git', ['add', 'package.json'], { cwd: root })
  execFileSync('git', ['commit', '-qm', subject], { cwd: root })

  return root
}

export function parseOutput(stdout: string) {
  return Object.fromEntries(
    stdout
      .trim()
      .split('\n')
      .map((line) => {
        const index = line.indexOf('=')

        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

const FAKE_ORAS = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" != pull ]]; then exit 1; fi
if [[ "\${2:-}" == *missing* ]]; then exit 1; fi
out=""
shift
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-o" ]]; then out=$2; shift 2; else shift; fi
done
mkdir -p "$out/nested/deep"
printf tool > "$out/nested/deep/ffmpeg-x"
printf '{}' > "$out/nested/deep/manifest.json"
`

const FAKE_GH = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GH_LOG"
case "$*" in
  *"/assets"*"--paginate"*) printf '7\\n' ;;
  *"--paginate"*) printf '17\\n' ;;
  *"-X DELETE"*) ;;
  *"-X POST"*"/releases"*"--jq .id"*) printf '99\\n' ;;
  *"uploads.github.com"*)
    for arg in "$@"; do
      if [[ "$arg" == https://uploads.github.com* ]]; then
        printf '%s\\n' "\${arg##*name=}"
      fi
    done
    ;;
  *) printf 'unexpected gh invocation: %s\\n' "$*" >&2; exit 1 ;;
esac
`

export function fakeGhEnv() {
  const root = tempDir()
  const bin = path.join(root, 'bin')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'gh'), FAKE_GH, { mode: 0o755 })

  const basePath = execFileSync('printenv', ['PATH'], { encoding: 'utf8' })

  return {
    root,
    env: {
      ...process.env,
      PATH: `${bin}:${basePath.trim()}`,
      GH_LOG: path.join(root, 'gh.log'),
    },
  }
}

export function fakeOrasEnv() {
  const root = tempDir()
  const bin = path.join(root, 'bin')

  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'oras'), FAKE_ORAS, { mode: 0o755 })

  const basePath = execFileSync('printenv', ['PATH'], { encoding: 'utf8' })

  return { root, env: { ...process.env, PATH: `${bin}:${basePath.trim()}` } }
}

/**
 * True when a job uses a repo script or action before checking out the repo.
 * Job keys sit at two spaces, the steps key at four, and step lines below it.
 */
function jobMissingCheckout(block: string) {
  const lines = block.split('\n')

  const steps = lines.findIndex((line) => {
    return STEPS_KEY.test(line)
  })

  if (steps === -1) {
    return false
  }

  const stepLines = lines.slice(steps)

  const checkout = stepLines.findIndex((line) => {
    return CHECKOUT_REFERENCE.test(line)
  })

  const reference = stepLines.findIndex((line) => {
    return REPO_REFERENCE.test(line)
  })

  return reference !== -1 && (checkout === -1 || checkout > reference)
}

export function jobsMissingCheckout(text: string) {
  const start = text.search(/^jobs:\s*$/m)
  const missing: string[] = []

  if (start === -1) {
    return missing
  }

  const section = text.slice(start)
  const end = section.search(/\n[^\s#]/)
  const body = section.slice(0, end === -1 ? section.length : end)
  const jobs = [...body.matchAll(JOB_START)]

  for (const [index, job] of jobs.entries()) {
    const name = job[1]

    if (isNil(name)) {
      continue
    }

    const block = body.slice(job.index ?? 0, jobs[index + 1]?.index ?? body.length)

    if (jobMissingCheckout(block)) {
      missing.push(name)
    }
  }

  return missing
}
