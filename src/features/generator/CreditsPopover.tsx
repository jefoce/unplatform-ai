'use client'

import { useCallback } from 'react'
import { isNil } from 'lodash-es'
import { ExternalLink, RefreshCw } from 'lucide-react'

import { formatUsd } from '@/core/pricing'
import { openSettings } from '@/features/settings/settings-store'
import { getPlatform } from '@/lib/platform'

import { CreditsRow } from './CreditsRow'
import { useCredits } from './use-credits'

function handleOpenSettings(): void {
  openSettings('openrouter')
}

function handleTopUp(): void {
  void getPlatform()
    .then((platform) => platform.openExternal('https://openrouter.ai/settings/credits'))
    .catch(() => {})
}

/** Account balance, key limits, usage, and refresh/top-up actions. */
export function CreditsPopover() {
  const { credits, refresh, isLoading } = useCredits()
  const money = (value: number | null | undefined) => (isNil(value) ? '--' : formatUsd(value))
  const keyLimit = isNil(credits?.keyLimitRemaining)
    ? 'No key limit'
    : `${money(credits.keyLimitRemaining)} / ${money(credits.keyLimit)}`
  const handleRefresh = useCallback((): void => refresh(true), [refresh])

  return (
    <div className="space-y-3">
      {isNil(credits?.balance) ? (
        <button
          type="button"
          onClick={handleOpenSettings}
          className="text-left text-xs text-fg-2 hover:text-fg hover:underline"
        >
          Add a management key to see account balance
        </button>
      ) : (
        <CreditsRow label="Balance" value={formatUsd(credits.balance)} />
      )}

      <CreditsRow label="Key limit" value={keyLimit} muted={isNil(credits?.keyLimitRemaining)} />
      <CreditsRow label="Spent today" value={money(credits?.usageDaily)} />
      <CreditsRow label="Spent this month" value={money(credits?.usageMonthly)} />
      <CreditsRow label="Spent in this app" value={money(credits?.localSpent)} />

      <div className="flex items-center justify-between border-t border-line pt-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-subtle px-2 text-xs text-fg hover:bg-hover disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <button
          type="button"
          onClick={handleTopUp}
          className="inline-flex items-center gap-1 text-xs text-lime hover:underline"
        >
          Top up
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  )
}
