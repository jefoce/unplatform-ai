/** Maps the e2e failure count to a process exit code. */
export function exitCodeFor(failed) {
  if (failed > 0) {
    return 1
  }

  return 0
}
