const TAIL_LINES = 40

/** Message for a browser that never opened its DevTools JSON endpoint. */
export function chromeStartError(params) {
  const { exitCode, stderr } = params
  const lines = String(stderr ?? '')
    .trimEnd()
    .split(/\r?\n/)
  const tail = lines.slice(-TAIL_LINES).join('\n')
  const exit =
    exitCode === null || exitCode === undefined ? 'still running' : `exit code ${String(exitCode)}`
  const detail = tail === '' ? 'no stderr' : tail

  return `Chrome did not start (${exit}). Last ${String(TAIL_LINES)} stderr lines:\n${detail}`
}
