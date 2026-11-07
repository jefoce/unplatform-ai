import 'server-only'

import { isNil } from 'lodash-es'

import { isMockMode } from './config/mock-mode'
import { acquireInstanceLock } from './instance-lock'
import { reconcileImages } from './jobs/image-reconcile'
import { runImageSubmit } from './jobs/image-run'
import { configureImageSubmitQueue } from './jobs/image-submit-queue'
import { onJobSent } from './jobs/job-events'
import { startPoller } from './jobs/poller'
import { runSubmit } from './jobs/run-submit'
import { configureSubmitQueue } from './jobs/submit-queue'
import { assertFfmpeg } from './media/ffmpeg'
import { startParentWatch } from './parent-watch'
import { STORAGE_ROOT } from './paths'
import { registerCustomImageShutdown } from './providers/custom/image-jobs'
import { createMockImageProvider } from './providers/mock/images'
import { registerAccountSecretsListener } from './providers/openrouter/account'
import { createOpenRouterImageProvider } from './providers/openrouter/images'
import { registerImageModelsSecretsListener } from './providers/openrouter/images-models'
import {
  registerOpenRouterPricing,
  registerPricingSecretsListener,
} from './providers/openrouter/pricing'
import { registerVideoModelsSecretsListener } from './providers/openrouter/video-models'
import { registerImageProvider } from './providers/registry'
import { secretsReady } from './secrets'
import { registerEndpointHealthListener } from './services/endpoint-health'
import { registerModelCatalogSecretsListener } from './services/model-catalog'
import { browserSessionUrl } from './session'
import { registerShutdownSignals } from './shutdown'
import { registerObjectStoreSecretsListener } from './storage/registry'

/** Prints the browser session URL as its own block. Desktop mode prints nothing. */
export function logBrowserSession(): void {
  const sessionUrl = browserSessionUrl()

  if (isNil(sessionUrl)) {
    return
  }

  console.log('')
  console.log(`[unplatform-ai] open ${sessionUrl}`)
  console.log('')
}

/** Composition root: wires every server dependency in one place. */
export async function bootServer(): Promise<void> {
  await acquireInstanceLock()
  registerShutdownSignals()

  logBrowserSession()

  // Never block readiness on the keychain. Routes and the poller await secretsReady().
  void secretsReady()

  // The listener set only serves later reloads, so registering after the first load is fine.
  registerOpenRouterPricing()
  registerPricingSecretsListener()
  registerAccountSecretsListener()
  registerVideoModelsSecretsListener()
  registerImageModelsSecretsListener()
  registerModelCatalogSecretsListener()
  registerObjectStoreSecretsListener()
  registerEndpointHealthListener()
  registerCustomImageShutdown()

  registerImageProvider('openrouter', () => {
    if (isMockMode()) {
      return createMockImageProvider()
    }

    return createOpenRouterImageProvider()
  })

  configureImageSubmitQueue({ run: runImageSubmit })
  configureSubmitQueue({ run: runSubmit })
  onJobSent(startPoller)

  startPoller()
  startParentWatch()
  await reconcileImages()

  const ffmpeg = assertFfmpeg()

  console.log('[unplatform-ai] storage', STORAGE_ROOT, 'ffmpeg', ffmpeg.path, ffmpeg.exists)
}
