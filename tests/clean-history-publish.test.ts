import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRIPT = path.join(ROOT, '.git/clean-history/publish-releases.sh')
const REPO = 'jefoce/unplatform-ai'

describe.skipIf(!fs.existsSync(SCRIPT))('clean history publish script', () => {
  it('targets the new repository and resolves paths from its own directory', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-releases-'))
    const bin = path.join(temp, 'bin')
    const calls = path.join(temp, 'calls')
    const script = path.join(temp, 'publish-releases.sh')

    try {
      fs.mkdirSync(bin)
      fs.copyFileSync(SCRIPT, script)

      fs.writeFileSync(
        path.join(bin, 'gh'),
        `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(calls)}\n`,
        { mode: 0o755 },
      )

      execFileSync('bash', [script], {
        env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` },
        stdio: 'pipe',
      })

      const recorded = fs.readFileSync(calls, 'utf8').split(/\r?\n/).filter(Boolean)
      const lines = fs.readFileSync(script, 'utf8').split(/\r?\n/)

      const creates = recorded.filter((line) => {
        return line.startsWith('release create ')
      })

      expect(recorded).toContain(`repo view ${REPO} --json name`)
      expect(recorded).toContain(`release list --repo ${REPO}`)
      expect(creates.length).toBeGreaterThan(0)

      for (const line of creates) {
        expect(line).toContain(`--repo ${REPO}`)

        const notes = line.match(/--notes-file (\S+)/)?.[1] ?? ''

        expect(notes.startsWith(`${temp}/releases/`)).toBe(true)
      }

      expect(
        lines.some((line) => {
          return /^\s*cd\s/.test(line)
        }),
      ).toBe(false)
    } finally {
      fs.rmSync(temp, { recursive: true, force: true })
    }
  })
})
