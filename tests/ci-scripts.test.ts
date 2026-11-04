/* eslint-disable max-lines -- CI script and workflow checks stay in one suite */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { isNil } from 'lodash-es'
import { afterEach, describe, expect, it } from 'vitest'

import {
  cleanupTempDirs,
  fakeGhEnv,
  fakeOrasEnv,
  gitRepo,
  jobsMissingCheckout,
  parseOutput,
  runScript,
  tempDir,
  writeFiles,
} from './helpers/ci-scripts'

interface RenameCase {
  target: string
  files: string[]
  expected: string[]
}

interface VersionCase {
  name: string
  subject: string
  env: Partial<NodeJS.ProcessEnv>
  expected?: Record<string, string>
  error?: string
}

interface PlanCase {
  name: string
  restore: string
  sources: string
  target: string
  expected: Record<string, string>
}

const RENAME_CASES: RenameCase[] = [
  {
    target: 'aarch64-apple-darwin',
    files: ['App.dmg', 'App.app.tar.gz', 'App.app.tar.gz.sig'],
    expected: [
      'unplatform-ai-0.2.0-macos-arm64.app.tar.gz',
      'unplatform-ai-0.2.0-macos-arm64.app.tar.gz.sig',
      'unplatform-ai-0.2.0-macos-arm64.dmg',
    ],
  },
  {
    target: 'x86_64-pc-windows-msvc',
    files: ['App-setup.exe', 'App-setup.exe.sig'],
    expected: [
      'unplatform-ai-0.2.0-windows-x64-setup.exe',
      'unplatform-ai-0.2.0-windows-x64-setup.exe.sig',
    ],
  },
  {
    target: 'x86_64-unknown-linux-gnu',
    files: ['App.AppImage', 'App.AppImage.sig', 'App.deb', 'App.rpm'],
    expected: [
      'unplatform-ai-0.2.0-linux-x64.AppImage',
      'unplatform-ai-0.2.0-linux-x64.AppImage.sig',
      'unplatform-ai-0.2.0-linux-x64.deb',
      'unplatform-ai-0.2.0-linux-x64.rpm',
    ],
  },
]

const BASE_ENV: Partial<NodeJS.ProcessEnv> = {
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF_TYPE: 'branch',
  GITHUB_REF_NAME: 'releases',
  TAG_INPUT: '',
}

const VERSION_CASES: VersionCase[] = [
  {
    name: 'accepts a matching dispatch rc tag',
    subject: '0.2.0',
    env: { GITHUB_EVENT_NAME: 'workflow_dispatch', TAG_INPUT: 'v0.2.0-rc.1' },
    expected: { version: '0.2.0', tag: 'v0.2.0-rc.1', prerelease: 'true' },
  },
  {
    name: 'rejects a dispatch tag from another version',
    subject: '0.2.0',
    env: { GITHUB_EVENT_NAME: 'workflow_dispatch', TAG_INPUT: 'v0.2.1-rc.1' },
    error: 'does not match version 0.2.0',
  },
  {
    name: 'accepts an rc tag push',
    subject: 'unrelated subject',
    env: { GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v0.2.0-rc.2' },
    expected: { version: '0.2.0', tag: 'v0.2.0-rc.2', prerelease: 'true' },
  },
  {
    name: 'accepts a releases push with the version title',
    subject: '0.2.0',
    env: {},
    expected: { version: '0.2.0', tag: 'v0.2.0', prerelease: 'false' },
  },
  {
    name: 'rejects a releases push with another title',
    subject: 'Bump deps',
    env: {},
    error: "commit title 'Bump deps' is not '0.2.0'",
  },
]

function releaseHistory(subjects: string[], version: string) {
  const root = tempDir()

  fs.writeFileSync(path.join(root, 'package.json'), `{"version":"${version}"}\n`)
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'ci@example.com'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'CI'], { cwd: root })
  execFileSync('git', ['add', 'package.json'], { cwd: root })

  for (const subject of subjects) {
    execFileSync('git', ['commit', '-qm', subject, '--allow-empty'], { cwd: root })
  }

  execFileSync('git', ['branch', '-M', 'releases'], { cwd: root })

  return root
}

const PLAN_CASES: PlanCase[] = [
  {
    name: 'keeps a restored Linux sidecar when the sources exist',
    restore: 'true',
    sources: 'true',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'false', out: 'ffmpeg-out' },
  },
  {
    name: 'rebuilds the Linux sources without touching ffmpeg-out',
    restore: 'true',
    sources: 'false',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'true', out: 'ffmpeg-rebuild' },
  },
  {
    name: 'builds into ffmpeg-out when the sidecar is missing',
    restore: 'false',
    sources: 'false',
    target: 'x86_64-unknown-linux-gnu',
    expected: { build: 'true', out: 'ffmpeg-out' },
  },
  {
    name: 'keeps a restored macOS sidecar without sources',
    restore: 'true',
    sources: 'false',
    target: 'aarch64-apple-darwin',
    expected: { build: 'false', out: 'ffmpeg-out' },
  },
]

const CALLER_SNIPPET = `found=$(bash .github/scripts/ghcr-pull.sh "$REF" "$DIR" ffmpeg-x manifest.json)
echo "found=$found" >> "$GITHUB_OUTPUT"
`

function callerOutput(ref: string) {
  const { root, env } = fakeOrasEnv()
  const githubOutput = path.join(root, 'github-output')

  fs.mkdirSync(path.join(root, '.github'))
  fs.symlinkSync(path.resolve('.github/scripts'), path.join(root, '.github', 'scripts'), 'dir')

  execFileSync('bash', ['-c', CALLER_SNIPPET], {
    cwd: root,
    env: { ...env, GITHUB_OUTPUT: githubOutput, REF: ref, DIR: path.join(root, 'cache') },
  })

  return fs.readFileSync(githubOutput, 'utf8')
}

afterEach(cleanupTempDirs)

describe('rename-installers.sh', () => {
  it.skipIf(process.platform === 'win32').each(RENAME_CASES)('names $target assets', (item) => {
    const root = tempDir()
    const bundle = path.join(root, 'bundle')
    const dist = path.join(root, 'dist')

    writeFiles(bundle, item.files)

    const result = runScript({
      script: 'rename-installers.sh',
      args: [bundle, '0.2.0', item.target, dist],
    })

    expect(result.status).toBe(0)
    expect(fs.readdirSync(dist).sort()).toEqual(item.expected.sort())
  })

  it.skipIf(process.platform === 'win32')('fails when a .sig is missing', () => {
    const root = tempDir()
    const bundle = path.join(root, 'bundle')

    writeFiles(bundle, ['App-setup.exe'])

    const result = runScript({
      script: 'rename-installers.sh',
      args: [bundle, '0.2.0', 'x86_64-pc-windows-msvc', path.join(root, 'dist')],
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('missing updater signature')
  })
})

describe('release-version.sh', () => {
  it.skipIf(process.platform === 'win32').each(VERSION_CASES)('$name', (item) => {
    const root = gitRepo(item.subject)

    const result = runScript({
      script: 'release-version.sh',
      cwd: root,
      env: { ...process.env, ...BASE_ENV, ...item.env },
    })

    if (!isNil(item.error)) {
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(item.error)

      return
    }

    expect(result.status).toBe(0)
    expect(parseOutput(result.stdout)).toEqual(item.expected)
  })
})

function versionRepo() {
  const root = gitRepo('0.2.0')

  fs.mkdirSync(path.join(root, 'src-tauri'))

  fs.writeFileSync(
    path.join(root, 'src-tauri', 'Cargo.toml'),
    '[package]\nname = "unplatform-ai"\nversion = "0.2.0"\n',
  )

  fs.writeFileSync(
    path.join(root, 'src-tauri', 'Cargo.lock'),
    '[[package]]\nname = "unplatform-ai"\nversion = "0.2.0"\n',
  )

  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '## 0.2.0\n')

  execFileSync('git', ['add', 'src-tauri', 'CHANGELOG.md'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'fixture'], { cwd: root })
  execFileSync('git', ['tag', 'v0.1.0'], { cwd: root })

  return root
}

describe('version-check.sh', () => {
  const REMINDER =
    'Not merged into releases. Apply these updates on the next version branch, then close this PR.'

  const dependabotEnv = {
    PR_AUTHOR: 'dependabot[bot]',
    BASE_REF: 'releases',
    PR_NUMBER: '7',
    TITLE: 'Bump deps',
    GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
  }

  it.skipIf(process.platform === 'win32')('turns a Dependabot PR into a reminder', () => {
    const { root, env } = fakeGhEnv()

    const result = runScript({
      script: 'version-check.sh',
      cwd: root,
      env: { ...env, ...dependabotEnv },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(REMINDER)

    const log = fs.readFileSync(path.join(root, 'gh.log'), 'utf8')

    expect(log).toContain('label create apply-on-next')
    expect(log).toContain('pr edit 7 --repo jefoce/unplatform-ai --add-label apply-on-next')
    expect(log).toContain('-X POST')
  })

  it.skipIf(process.platform === 'win32')('updates the existing reminder comment', () => {
    const { root, env } = fakeGhEnv()

    const result = runScript({
      script: 'version-check.sh',
      cwd: root,
      env: { ...env, ...dependabotEnv, GH_COMMENT_ID: '42' },
    })

    expect(result.status).toBe(0)

    const log = fs.readFileSync(path.join(root, 'gh.log'), 'utf8')

    expect(log).toContain('-X PATCH')
    expect(log).toContain('comments/42')
    expect(log).not.toContain('-X POST')
  })

  it.skipIf(process.platform === 'win32')(
    'rejects a releases PR without the version subject',
    () => {
      const root = versionRepo()

      const result = runScript({
        script: 'version-check.sh',
        cwd: root,
        env: {
          ...process.env,
          PR_AUTHOR: 'contributor',
          BASE_REF: 'releases',
          PR_NUMBER: '8',
          TITLE: 'Bump deps',
          GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
        },
      })

      expect(result.status).not.toBe(0)
      expect(result.stdout).toContain("PR title must be '0.2.0'")
    },
  )
})

describe('release-repository.sh', () => {
  const cases = [
    { version: '0.4.0', repo: 'jefoce/unplatform-ai', status: 0 },
    { version: '0.4.1', repo: 'jefoce/unplatform-ai', status: 0 },
    { version: '0.10.0', repo: 'jefoce/unplatform-ai', status: 0 },
    { version: '0.3.2', repo: 'jefoce/unplatform-ai', status: 1 },
    { version: '0.3.2', repo: 'jefoce/old-app', status: 1 },
    { version: '0.3.1', repo: 'jefoce/old-app', status: 1 },
    { version: '0.4.0', repo: 'jefoce/old-app', status: 1 },
    { version: '0.5.0', repo: 'someone/unplatform-ai', status: 1 },
  ]

  it.skipIf(process.platform === 'win32').each(cases)('checks $version in $repo', (item) => {
    const result = runScript({
      script: 'release-repository.sh',
      env: { ...process.env, VERSION: item.version, GITHUB_REPOSITORY: item.repo },
    })

    expect(result.status).toBe(item.status)
  })

  it('keeps the bridge release out of this repository', () => {
    const script = fs.readFileSync(path.resolve('.github/scripts/release-repository.sh'), 'utf8')

    expect(script).not.toContain('0.3.2')
    expect(script).not.toContain('old-app')
  })

  it.skipIf(process.platform === 'win32')('accepts six ascending release versions', () => {
    const root = releaseHistory(['0.1.0', '0.1.1', '0.2.0', '0.3.0', '0.3.1', '0.4.0'], '0.4.0')

    const result = runScript({
      script: 'release-repository.sh',
      cwd: root,
      env: {
        ...process.env,
        VERSION: '0.4.0',
        GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
        GITHUB_REF_NAME: 'releases',
      },
    })

    expect(result.status).toBe(0)
  })

  it.skipIf(process.platform === 'win32')('rejects descending release versions', () => {
    const root = releaseHistory(['0.1.0', '0.1.1', '0.2.0', '0.3.1', '0.3.0', '0.4.0'], '0.4.0')

    const result = runScript({
      script: 'release-repository.sh',
      cwd: root,
      env: {
        ...process.env,
        VERSION: '0.4.0',
        GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
        GITHUB_REF_NAME: 'releases',
      },
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('not strictly ascending')
  })

  it.skipIf(process.platform === 'win32')(
    'rejects a newest version that is not the package version',
    () => {
      const root = releaseHistory(['0.1.0', '0.1.1', '0.2.0', '0.3.0', '0.3.1', '0.5.0'], '0.4.0')

      const result = runScript({
        script: 'release-repository.sh',
        cwd: root,
        env: {
          ...process.env,
          VERSION: '0.4.0',
          GITHUB_REPOSITORY: 'jefoce/unplatform-ai',
          GITHUB_REF_NAME: 'releases',
        },
      })

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('is not package version 0.4.0')
    },
  )
})

describe('ffmpeg-sources-tag.sh', () => {
  it.skipIf(process.platform === 'win32')('matches the inline versions.env tag', () => {
    const expected = execFileSync(
      'bash',
      [
        '-c',
        'source scripts/ffmpeg/versions.env; printf %s "ffmpeg-$FFMPEG_VERSION-x264-${X264_COMMIT:0:8}-zlib-$ZLIB_VERSION"',
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    )

    const result = runScript({ script: 'ffmpeg-sources-tag.sh' })

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(expected)
  })
})

describe('ffmpeg-plan.sh', () => {
  it.skipIf(process.platform === 'win32').each(PLAN_CASES)('$name', (item) => {
    const output = path.join(tempDir(), 'output')

    const result = runScript({
      script: 'ffmpeg-plan.sh',
      env: {
        ...process.env,
        GITHUB_OUTPUT: output,
        RESTORE_FOUND: item.restore,
        SOURCES_FOUND: item.sources,
        TARGET: item.target,
      },
    })

    expect(result.status).toBe(0)
    expect(parseOutput(fs.readFileSync(output, 'utf8'))).toEqual(item.expected)
  })
})

describe('node build-unix.sh', () => {
  const script = fs.readFileSync(path.resolve('scripts/node/build-unix.sh'), 'utf8')

  it('validates NODE_CONFIGURE_EXTRA against configure --help', () => {
    expect(script).toContain('read -r -a extra_flags')
    expect(script).toContain('NODE_CONFIGURE_EXTRA token must start with --')
    expect(script).toContain('unknown configure flag')
  })

  it('disables Amaro in the base configure flags', () => {
    expect(script).toContain(
      'for flag in --with-intl --without-npm --without-corepack --without-amaro; do',
    )

    expect(script).toContain('--without-corepack --without-amaro --enable-lto')
  })

  it('applies NODE_OUTPUT_SUFFIX to the cache path and binary name', () => {
    expect(script).toContain('SUFFIX=${NODE_OUTPUT_SUFFIX:-}')
    expect(script).toContain('VARIANT="$NODE_VERSION-small-icu$SUFFIX"')
    expect(script).toContain('unplatform-ai-server-$TARGET$SUFFIX')
  })
})

const WORKFLOW_FILES = ['.github/workflows/checks.yml', '.github/workflows/release.yml']

/** Every workflow and action YAML file, recursively. */
function ciYamlFiles(dir: string): string[] {
  return fs.readdirSync(path.resolve(dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      return ciYamlFiles(rel)
    }

    return entry.name.endsWith('.yml') ? [rel] : []
  })
}

const CI_YAML_FILES = [...ciYamlFiles('.github/workflows'), ...ciYamlFiles('.github/actions')]

describe('runner images', () => {
  it.each(CI_YAML_FILES)('%s pins a fixed runner image', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    const latest = text.split(/\r?\n/).filter((line) => {
      return /^\s*(?:-\s*)?(?:runs-on|runner):\s*(?:ubuntu|windows)-latest\b/.test(line)
    })

    expect(latest, file).toEqual([])
  })
})

describe('workflow checkouts', () => {
  it.each(WORKFLOW_FILES)('%s checks out before using repo files', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    expect(jobsMissingCheckout(text)).toEqual([])
  })
})

describe('Rust tests', () => {
  it.each(WORKFLOW_FILES)('%s runs cargo test', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    expect(text).toContain('cargo test --manifest-path src-tauri/Cargo.toml')
  })
})

describe('GHCR owner', () => {
  it('comes from github.repository_owner', () => {
    for (const file of CI_YAML_FILES) {
      const text = fs.readFileSync(path.resolve(file), 'utf8')

      expect(text, file).not.toContain('ghcr.io/jefoce')
    }

    const sidecars = fs.readFileSync(
      path.resolve('.github/actions/sidecar-restore/action.yml'),
      'utf8',
    )

    expect(sidecars).toContain('ghcr.io/${{ github.repository_owner }}/unplatform-ai-sidecars')
  })

  it('documents the first release in a new repository', () => {
    const text = fs.readFileSync(path.resolve('docs/DEVELOPMENT.md'), 'utf8')

    expect(text).toContain('SIDECARS_RUN_ID')
    expect(text).toContain('reuse_sidecars_run_id')
    expect(text).toContain('force_rebuild_sidecars')
    expect(text.toLowerCase()).toContain('missing from this repository')
  })
})

describe('redistributable ffmpeg', () => {
  it('CI never allows the nonfree fallback', () => {
    for (const file of CI_YAML_FILES) {
      const text = fs.readFileSync(path.resolve(file), 'utf8')

      expect(text, file).not.toContain('ALLOW_NONFREE_FFMPEG')
    }
  })
})

describe('zstd tooling', () => {
  it.each(CI_YAML_FILES)('%s never installs the zstd CLI', (file) => {
    const text = fs.readFileSync(path.resolve(file), 'utf8')

    expect(text, file).not.toMatch(/choco install zstd|brew install zstd/)
  })
})

describe('ghcr-pull.sh', () => {
  it.skipIf(process.platform === 'win32')('flattens the pulled tree', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:tag', 'cache', 'ffmpeg-x', 'manifest.json'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('true\n')
    expect(fs.existsSync(path.join(work, 'cache', 'ffmpeg-x'))).toBe(true)
    expect(fs.existsSync(path.join(work, 'cache', 'manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(work, 'cache', 'nested'))).toBe(false)
  })

  it.skipIf(process.platform === 'win32')('reports a missing required file', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:tag', 'cache', 'other'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('false\n')
    expect(result.stderr).toContain('GHCR tag incomplete')
  })

  it.skipIf(process.platform === 'win32')('reports a failed pull', () => {
    const { root, env } = fakeOrasEnv()
    const work = path.join(root, 'work')

    fs.mkdirSync(work)

    const result = runScript({
      script: 'ghcr-pull.sh',
      args: ['ghcr.io/test:missing', 'cache', 'ffmpeg-x'],
      cwd: work,
      env,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('false\n')
  })

  it.skipIf(process.platform === 'win32')('writes found=true from the caller step', () => {
    expect(callerOutput('ghcr.io/test:tag')).toBe('found=true\n')
  })

  it.skipIf(process.platform === 'win32')('writes found=false from the caller step', () => {
    expect(callerOutput('ghcr.io/test:missing')).toBe('found=false\n')
  })
})

describe('sidecar-manifest.mjs', () => {
  it.skipIf(process.platform === 'win32')('keeps builtBy through a manifest round trip', () => {
    const root = tempDir()
    const binary = path.join(root, 'binary')
    const manifest = path.join(root, 'manifest.json')

    fs.writeFileSync(binary, 'binary\n')

    execFileSync(
      process.execPath,
      [
        path.resolve('.github/scripts/sidecar-manifest.mjs'),
        'write',
        binary,
        manifest,
        'ffmpeg',
        'aarch64-apple-darwin',
        '0.4.0',
        'minimal',
      ],
      {
        env: {
          ...process.env,
          SIDECAR_BUILT_BY: 'ci',
        },
      },
    )

    const written = JSON.parse(fs.readFileSync(manifest, 'utf8'))

    expect(written).toMatchObject({ builtBy: 'ci', profile: 'minimal' })

    execFileSync(
      process.execPath,
      [path.resolve('.github/scripts/sidecar-manifest.mjs'), 'verify', binary, manifest],
      { encoding: 'utf8' },
    )
  })
})

interface MacLinkParams {
  links: string[]
  archs: string
  minos: string
}

function macLinkFixture(params: MacLinkParams) {
  const { links, archs, minos } = params
  const root = tempDir()
  const bin = path.join(root, 'bin')
  const binary = path.join(root, 'binary')
  const basePath = execFileSync('printenv', ['PATH'], { encoding: 'utf8' }).trim()

  fs.mkdirSync(bin)

  for (const tool of ['otool', 'vtool', 'lipo']) {
    const script = `#!/usr/bin/env bash
set -euo pipefail
cat "$MAC_TOOL_DIR/${tool}.txt"
`

    fs.writeFileSync(path.join(bin, tool), script, { mode: 0o755 })
  }

  const dependencies = links.map((link) => {
    return `\t${link}`
  })

  fs.writeFileSync(path.join(root, 'otool.txt'), ['binary:', ...dependencies].join('\n'))
  fs.writeFileSync(path.join(root, 'vtool.txt'), `platform MACOS\n    minos ${minos}\n`)
  fs.writeFileSync(path.join(root, 'lipo.txt'), `${archs}\n`)
  fs.writeFileSync(binary, 'binary\n')

  return {
    binary,
    env: {
      ...process.env,
      PATH: `${bin}:${basePath}`,
      MAC_TOOL_DIR: root,
    },
  }
}

describe('check-macos-sidecar.sh', () => {
  it.skipIf(process.platform === 'win32')(
    'passes a system-only arm64 binary with minos 13.0',
    () => {
      const { binary, env } = macLinkFixture({
        links: [
          '/usr/lib/libSystem.B.dylib',
          '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation',
        ],
        archs: 'arm64',
        minos: '13.0',
      })

      const result = runScript({ script: 'check-macos-sidecar.sh', args: [binary], env })

      expect(result.status).toBe(0)
      expect(result.stdout).toContain(`[macos] ${binary}`)
    },
  )

  it.skipIf(process.platform === 'win32')('rejects a link outside the system paths', () => {
    const { binary, env } = macLinkFixture({
      links: ['/opt/homebrew/lib/libfoo.dylib'],
      archs: 'arm64',
      minos: '13.0',
    })

    const result = runScript({ script: 'check-macos-sidecar.sh', args: [binary], env })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('/opt/homebrew/lib/libfoo.dylib')
  })

  it.skipIf(process.platform === 'win32')('rejects another minimum macOS version', () => {
    const { binary, env } = macLinkFixture({
      links: ['/usr/lib/libSystem.B.dylib'],
      archs: 'arm64',
      minos: '14.0',
    })

    const result = runScript({ script: 'check-macos-sidecar.sh', args: [binary], env })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('minos 13.0')
  })

  it.skipIf(process.platform === 'win32')('rejects a non-arm64 binary', () => {
    const { binary, env } = macLinkFixture({
      links: ['/usr/lib/libSystem.B.dylib'],
      archs: 'x86_64',
      minos: '13.0',
    })

    const result = runScript({ script: 'check-macos-sidecar.sh', args: [binary], env })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('expected arm64')
  })
})
