import path from 'node:path'

/**
 * Target triple from `--target`, its `=` form, or the Tauri build env.
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} [env]
 */
export function targetFromArgs(argv, env = process.env) {
  const inline = argv.find((arg) => arg.startsWith('--target='))
  const index = argv.indexOf('--target')

  return (
    inline?.slice('--target='.length) ||
    (index === -1 ? undefined : argv[index + 1]) ||
    env.TAURI_ENV_TARGET_TRIPLE ||
    undefined
  )
}

/** Bundle directory for a target triple, or the host layout when there is none. */
export function bundleDir(params) {
  const { root, target } = params
  const base = path.join(root, 'src-tauri', 'target')

  return target
    ? path.join(base, target, 'release', 'bundle')
    : path.join(base, 'release', 'bundle')
}
