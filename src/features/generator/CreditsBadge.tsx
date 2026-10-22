'use client'

import { isNil } from 'lodash-es'
import { Wallet } from 'lucide-react'

import { CREDIT_DANGER_USD, CREDIT_WARN_USD } from '@/core/constants'
import { formatUsd } from '@/core/pricing'
import type { CreditsInfo } from '@/core/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/Popover'
import { Tooltip } from '@/ui/Tooltip'

import { CreditsPopover } from './CreditsPopover'
import { useCredits } from './use-credits'

function summarize(credits: CreditsInfo | undefined): { text: string; amount: number | null } {
  if (!credits || (!isNil(credits.error) && credits.error !== '')) {
    return { text: '--', amount: null }
  }

  if (!isNil(credits.balance)) return { text: formatUsd(credits.balance), amount: credits.balance }

  if (!isNil(credits.keyLimitRemaining)) {
    return { text: formatUsd(credits.keyLimitRemaining), amount: credits.keyLimitRemaining }
  }

  if (!isNil(credits.usageDaily))
    return { text: `Today ${formatUsd(credits.usageDaily)}`, amount: null }

  return { text: '--', amount: null }
}

/** Balance tone. */
function toneFor(amount: number | null): string {
  if (isNil(amount)) return 'text-fg-2'

  if (amount < CREDIT_DANGER_USD) return 'text-danger'

  if (amount < CREDIT_WARN_USD) return 'text-amber'

  return 'text-fg'
}

/** OpenRouter balance pill. Warning colors only, never blocks Generate. */
export function CreditsBadge() {
  const { credits, isLoading } = useCredits()
  const { text, amount } = summarize(credits)
  const tone = toneFor(amount)

  return (
    <Popover>
      <Tooltip content={credits?.error}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/8 bg-white/2 px-2 text-xs font-medium"
          >
            <Wallet size={12} className="text-fg-2" />
            {isLoading ? (
              <span className="inline-block h-3 w-8 animate-pulse rounded-sm bg-white/10" />
            ) : (
              <span className={tone}>{text}</span>
            )}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-72">
        <CreditsPopover />
      </PopoverContent>
    </Popover>
  )
}
