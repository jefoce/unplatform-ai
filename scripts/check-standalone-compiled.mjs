#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ALLOWLIST = path.join(ROOT, 'scripts', 'standalone-allowlist.json')
const SPEC_PATTERN =
  /(?:require\s*\(\s*|import\s*\(\s*|from\s+)['"](next\/dist\/compiled\/[^'"]+)['"]/g
const SKIP = [
  'src-tauri/',
  'node_modules/next/dist/build/',
  'node_modules/next/dist/experimental/testmode/',
]

/** Target directory from argv, default `.next/standalone`. */
function targetDir() {
  const [arg] = process.argv.slice(2).filter((value) => value !== '--')
  return path.resolve(arg ?? '.next/standalone')
}

/** True when a target-relative path sits in one of the skipped trees. */
function isSkipped(relative) {
  const normalized = relative.split(path.sep).join('/')
  return SKIP.some((prefix) => normalized.startsWith(prefix))
}

/** Every `.js` file under `dir`, skipping the ignored trees. */
function walk(dir, target, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (isSkipped(path.relative(target, full))) continue
      walk(full, target, files)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(full)
  }
  return files
}

/** Resolution candidates for a compiled spec under `<target>/node_modules`. */
function candidates(spec) {
  const base = spec.endsWith('/package.json') ? spec.slice(0, -'/package.json'.length) : spec
  return [base, `${base}.js`, path.join(base, 'index.js'), `${base}.mjs`, `${base}/package.json`]
}

/** True when any candidate exists under the target `node_modules`. */
function resolves(target, spec) {
  return candidates(spec).some((candidate) =>
    fs.existsSync(path.join(target, 'node_modules', candidate)),
  )
}

/** Allowlist entries, an empty list when the file is absent. */
function allowlist() {
  const text = fs.readFileSync(ALLOWLIST, 'utf8')
  return JSON.parse(text)
}

const target = targetDir()
const files = walk(target, target)
const missing = new Map()

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const relative = path.relative(target, file)

  for (const match of text.matchAll(SPEC_PATTERN)) {
    const spec = match[1]
    if (resolves(target, spec)) continue
    if (!missing.has(spec)) missing.set(spec, new Set())
    missing.get(spec).add(relative)
  }
}

const allowed = allowlist()
const failures = []
for (const [spec, sources] of missing) {
  const covered = allowed.some((entry) => spec.startsWith(entry.prefix))
  if (covered) continue
  failures.push(`${spec} (files: ${[...sources].join(', ')})`)
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`MISSING ${failure}`)
  }
  process.exit(1)
}

console.log(
  `[check-standalone] ${files.length} files scanned, ${missing.size} missing spec(s) all allowlisted`,
)
