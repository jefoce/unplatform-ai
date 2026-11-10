import 'server-only'

import { isNil } from 'lodash-es'

import {
  PROVIDER_KIND_IDS,
  type ProviderKindId,
  type StorageProviderId,
} from '@/core/providers/types'
import type { TestResult } from '@/core/types'

import { getVideoProvider } from '../providers/registry'
import { secretsReady } from '../secrets'
import { testR2 } from '../storage/r2'
import { getObjectStore } from '../storage/registry'
import { clearModelCatalog } from './model-catalog'

type TestTarget = ProviderKindId | StorageProviderId

function isVideoTarget(target: TestTarget): target is ProviderKindId {
  return (PROVIDER_KIND_IDS as readonly string[]).includes(target)
}

/** Tests the stored credentials without returning them. */
export async function testConnection(target: TestTarget): Promise<TestResult> {
  await secretsReady()

  if (isVideoTarget(target)) {
    const result = await getVideoProvider(target).testConnection()

    clearModelCatalog()

    return result
  }

  const store = getObjectStore()

  if (isNil(store)) {
    return testR2()
  }

  const result = await store.testConnection()

  clearModelCatalog()

  return result
}
