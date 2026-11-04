import 'server-only'

import { filter, isNil, sumBy } from 'lodash-es'

import type { CreditsInfo } from '@/core/types'

import { getVideoProvider } from '../providers/registry'
import { listGenerations } from '../repos/generations'
import { listImages } from '../repos/images'

interface GetCreditsParams {
  fresh?: boolean
}

/** Provider account credits combined with what this app spent locally. */
export async function getCredits(params: GetCreditsParams = {}): Promise<CreditsInfo> {
  const isFresh = params.fresh
  const account = await getVideoProvider().getAccount({ fresh: isFresh })
  const local = await spentLocally()

  return { ...account, error: account.error ?? undefined, ...local }
}

interface LocalSpend {
  localSpent: number
  localSpentUnknown: number
}

async function spentLocally(): Promise<LocalSpend> {
  const [records, images] = await Promise.all([listGenerations(), listImages()])
  const all = [...records, ...images]

  const localSpent = sumBy(all, (record) => {
    return record.cost.actualUsd ?? 0
  })

  const localSpentUnknown = filter(all, (record) => {
    return isNil(record.cost.actualUsd)
  }).length

  return { localSpent, localSpentUnknown }
}
