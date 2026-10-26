import 'server-only'

import { isNil } from 'lodash-es'

import {
  type StorageProviderId,
  VIDEO_PROVIDER_IDS,
  type VideoProviderId,
} from '@/core/providers/types'
import type { TestResult } from '@/core/types'

import { getVideoProvider } from '../providers/registry'
import { secretsReady } from '../secrets'
import { testR2 } from '../storage/r2'
import { getObjectStore } from '../storage/registry'

type TestTarget = VideoProviderId | StorageProviderId

function isVideoTarget(target: TestTarget): target is VideoProviderId {
  return (VIDEO_PROVIDER_IDS as readonly string[]).includes(target)
}

/** Tests the stored credentials without returning them. */
export async function testConnection(target: TestTarget): Promise<TestResult> {
  await secretsReady()

  if (isVideoTarget(target)) {
    return getVideoProvider(target).testConnection()
  }

  const store = getObjectStore()

  if (isNil(store)) {
    return testR2()
  }

  return store.testConnection()
}
