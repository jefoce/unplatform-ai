/**
 * Boots the Node runtime: instance lock, secrets, job poller, ffmpeg check.
 * Server modules are imported dynamically so the Edge build stays clean.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { acquireInstanceLock } = await import('@/server/instance-lock')

  await acquireInstanceLock()

  const { secretsReady } = await import('@/server/secrets')

  // Never block readiness on the keychain. Routes and the poller await secretsReady().
  void secretsReady()

  // Registers the submit runner before the poller resumes grace records.
  await import('@/server/jobs/run-submit')
  const { startPoller } = await import('@/server/jobs/poller')

  startPoller()

  const { startParentWatch } = await import('@/server/parent-watch')

  startParentWatch()

  const [{ assertFfmpeg }, { STORAGE_ROOT }] = await Promise.all([
    import('@/server/media/ffmpeg'),
    import('@/server/paths'),
  ])
  const ffmpeg = assertFfmpeg()

  console.log('[unplatform-ai] storage', STORAGE_ROOT, 'ffmpeg', ffmpeg.path, ffmpeg.exists)
}
