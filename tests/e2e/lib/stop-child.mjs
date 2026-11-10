import { spawn } from 'node:child_process'

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForExit(child, timeoutMs) {
  if (hasExited(child)) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false)
    }, timeoutMs)

    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error
    }
  }
}

function destroyPipes(child) {
  for (const stream of [child.stdin, child.stdout, child.stderr]) {
    stream?.destroy?.()
  }
}

function ignoreSpawnError() {}

/**
 * Stops a server child, killing its group on POSIX and its tree through taskkill on Windows.
 * Pipes are destroyed whether the child exits or the timeout wins.
 */
export async function stopChild({ child, platform = process.platform, spawnFn, timeoutMs = 5000 }) {
  const spawnChild = spawnFn ?? spawn

  if (!hasExited(child)) {
    if (platform === 'win32') {
      try {
        const killer = spawnChild('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        killer?.on?.('error', ignoreSpawnError)
      } catch {
        // A spawn failure leaves the timeout and SIGKILL path below.
      }
    } else {
      signalGroup(child.pid, 'SIGTERM')
    }

    const exited = await waitForExit(child, timeoutMs)

    if (!exited) {
      if (platform === 'win32') {
        child.kill('SIGKILL')
      } else {
        signalGroup(child.pid, 'SIGKILL')
      }
    }
  }

  destroyPipes(child)
}
