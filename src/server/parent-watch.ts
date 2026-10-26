import 'server-only'

const CHECK_MS = 1000

/**
 * Exits this process when the desktop parent (PARENT_PID) disappears.
 * Relies on the instance-lock exit handler to remove server.lock.
 */
export function startParentWatch(): () => void {
  const pid = Number(process.env.PARENT_PID)

  if (!Number.isInteger(pid) || pid <= 0) {
    return () => {}
  }

  const timer = setInterval(() => {
    if (isAlive(pid)) {
      return
    }

    clearInterval(timer)
    console.log('[unplatform-ai] parent exited, shutting down')
    process.exit(0)
  }, CHECK_MS)

  return () => {
    clearInterval(timer)
  }
}

/** EPERM means the parent exists but is not signalable, so treat it as alive. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)

    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}
