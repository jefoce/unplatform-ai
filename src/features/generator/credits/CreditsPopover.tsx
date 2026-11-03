'use client'

import { isNil } from 'lodash-es'
import { ExternalLink, RefreshCw } from 'lucide-react'

import { formatUsd } from '@/core/pricing/format'
import { OPENROUTER_CREDITS_URL } from '@/core/providers/openrouter'
import type { CreditsInfo } from '@/core/types'
import { openSettings } from '@/features/settings/settings-store'
import { useCredits } from '@/lib/api/credits'
import { formatAgo } from '@/lib/format'
import { getPlatform } from '@/lib/platform'
import { useNow } from '@/lib/use-now'

import { CreditsRow } from './CreditsRow'

function handleOpenSettings(): void {
  openSettings('openrouter')
}

function handleTopUp(): void {
  void getPlatform()
    .then((platform) => {
      return platform.openExternal(OPENROUTER_CREDITS_URL)
    })
    .catch(() => {})
}

interface LocalSpendTextParams {
  spent: number | undefined
  unknown: number | undefined
}

function money(value: number | null | undefined): string {
  if (isNil(value)) {
    return '--'
  }

  return formatUsd(value)
}

function keyLimitText(credits: CreditsInfo | undefined): string {
  if (isNil(credits?.keyLimitRemaining)) {
    return 'No key limit'
  }

  return `${money(credits.keyLimitRemaining)} / ${money(credits.keyLimit)}`
}

function runCount(count: number): string {
  if (count === 1) {
    return '1 run'
  }

  return `${count} runs`
}

/** Known local spend, marked as a floor when some runs never reported a cost. */
function localSpendText(params: LocalSpendTextParams): string {
  const { spent, unknown } = params

  if (isNil(spent)) {
    return '--'
  }

  const count = unknown ?? 0

  if (count > 0) {
    return `at least ${formatUsd(spent)} (${runCount(count)})`
  }

  return formatUsd(spent)
}

/** Account balance, key limits, usage, and refresh/top-up actions. */
export function CreditsPopover() {
  const { credits, refresh, isLoading } = useCredits()
  const now = useNow(true)

  const isKeyLimit = isNil(credits?.keyLimitRemaining)

  const handleRefresh = (): void => {
    refresh(true)
  }

  const balance = credits?.balance

  return (
    <div className="space-y-3">
      {isNil(balance) && (
        <button
          type="button"
          onClick={handleOpenSettings}
          className="text-left text-xs text-fg-2 hover:text-fg hover:underline"
        >
          Add a management key to see account balance
        </button>
      )}
      {!isNil(balance) && <CreditsRow label="Balance" value={formatUsd(balance)} />}

      <CreditsRow label="Key limit" value={keyLimitText(credits)} muted={isKeyLimit} />
      <CreditsRow label="Spent today" value={money(credits?.usageDaily)} />
      <CreditsRow label="Spent this month" value={money(credits?.usageMonthly)} />
      <CreditsRow
        label="Spent in this app"
        value={localSpendText({ spent: credits?.localSpent, unknown: credits?.localSpentUnknown })}
      />

      <div className="flex items-center justify-between border-t border-line pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-subtle px-2 text-xs text-fg hover:bg-hover disabled:opacity-40"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          {!isNil(credits) && (
            <span className="text-xs text-fg-2">Updated {formatAgo(credits.fetchedAt, now)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleTopUp}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Top up
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  )
}
