import { isNil } from 'lodash-es'

import type { CardAction } from './card-action'

const TOP_PX = 12
const ROW_PX = 24
const GAP_PX = 4
const BOTTOM_PX = 8

/** Actions dropped first when the column is too tall. The More menu keeps them. */
const DROP_ORDER = ['download', 'reference', 'use'] as const

interface FitCompactActionsParams {
  actions: CardAction[]
  height: number
}

/** Column height with the More menu counted as one button. */
function columnHeight(count: number): number {
  return TOP_PX + count * ROW_PX + Math.max(count - 1, 0) * GAP_PX + BOTTOM_PX
}

function fits(actions: readonly CardAction[], height: number): boolean {
  return columnHeight(actions.length + 1) <= height
}

/** Drops actions the More menu already offers until the column fits a short tile. */
export function fitCompactActions(params: FitCompactActionsParams): CardAction[] {
  const { actions, height } = params
  let kept = [...actions]

  for (const key of DROP_ORDER) {
    if (fits(kept, height)) {
      return kept
    }

    kept = kept.filter((action) => {
      return action.key !== key
    })
  }

  if (fits(kept, height)) {
    return kept
  }

  const fallback = kept.find((action) => {
    return action.key === 'favorite'
  })

  if (!isNil(fallback)) {
    return [fallback]
  }

  return kept.slice(0, 1)
}
