'use client'

import { isNil } from 'lodash-es'

import type { CatalogEntry } from '@/core/catalog'
import { useSecrets } from '@/features/settings/use-secrets'
import { useCredits } from '@/lib/api/credits'
import { useModelEntry } from '@/lib/api/models'

const PROVIDER_KEY_REASON = 'Add your OpenRouter key in Settings.'

export interface ProviderReady {
  isKeyMissing: boolean
  isReady: boolean
  reason: string | null
}

interface ProviderBlockParams {
  entry: CatalogEntry | null
  isKeyMissing: boolean
}

function providerBlock(params: ProviderBlockParams): string | null {
  const { entry, isKeyMissing } = params
  const isBlocked = entry?.status === 'missing' || entry?.status === 'no_provider'

  if (isBlocked) {
    return entry?.reason ?? PROVIDER_KEY_REASON
  }

  if (isKeyMissing) {
    return PROVIDER_KEY_REASON
  }

  return null
}

/** Key and catalog readiness shared by the video and image generators. */
export function useProviderReady(presetId?: string): ProviderReady {
  const { status } = useSecrets()
  const { credits } = useCredits()
  const entry = useModelEntry(presetId ?? '')
  const isMock = credits?.source === 'mock'
  const isKeyMissing = !isNil(status) && !status.keys.OPENROUTER_API_KEY.set && !isMock
  const reason = providerBlock({ entry, isKeyMissing })

  return { isKeyMissing, isReady: isNil(reason), reason }
}
