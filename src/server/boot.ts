import 'server-only'

import { acquireInstanceLock } from './instance-lock'
import { onJobSent } from './jobs/job-events'
import { startPoller } from './jobs/poller'
import { runSubmit } from './jobs/run-submit'
import { configureSubmitQueue } from './jobs/submit-queue'
import { assertFfmpeg } from './media/ffmpeg'
import { startParentWatch } from './parent-watch'
import { STORAGE_ROOT } from './paths'
import { secretsReady } from './secrets'

/** Composition root: wires every server dependency in one place. */
export async function bootServer(): Promise<void> {
  await acquireInstanceLock()

  // Never block readiness on the keychain. Routes and the poller await secretsReady().
  void secretsReady()

  configureSubmitQueue({ run: runSubmit })
  onJobSent(startPoller)

  startPoller()
  startParentWatch()

  const ffmpeg = assertFfmpeg()

  console.log('[unplatform-ai] storage', STORAGE_ROOT, 'ffmpeg', ffmpeg.path, ffmpeg.exists)
}
