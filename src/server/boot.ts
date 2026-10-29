import 'server-only'

import { acquireInstanceLock } from './instance-lock'
import { onJobSent } from './jobs/job-events'
import { startPoller } from './jobs/poller'
import { runSubmit } from './jobs/run-submit'
import { configureSubmitQueue } from './jobs/submit-queue'
import { assertFfmpeg } from './media/ffmpeg'
import { startParentWatch } from './parent-watch'
import { STORAGE_ROOT } from './paths'
import { registerAccountSecretsListener } from './providers/openrouter/account'
import { registerPricingSecretsListener } from './providers/openrouter/pricing'
import { registerVideoModelsSecretsListener } from './providers/openrouter/video-models'
import { secretsReady } from './secrets'
import { registerObjectStoreSecretsListener } from './storage/registry'

/** Composition root: wires every server dependency in one place. */
export async function bootServer(): Promise<void> {
  await acquireInstanceLock()

  // Never block readiness on the keychain. Routes and the poller await secretsReady().
  void secretsReady()

  // The listener set only serves later reloads, so registering after the first load is fine.
  registerPricingSecretsListener()
  registerAccountSecretsListener()
  registerVideoModelsSecretsListener()
  registerObjectStoreSecretsListener()

  configureSubmitQueue({ run: runSubmit })
  onJobSent(startPoller)

  startPoller()
  startParentWatch()

  const ffmpeg = assertFfmpeg()

  console.log('[unplatform-ai] storage', STORAGE_ROOT, 'ffmpeg', ffmpeg.path, ffmpeg.exists)
}
