'use client'

import { isNil } from 'lodash-es'
import { Sparkles } from 'lucide-react'

import { formatUsd } from '@/core/pricing'
import { cn } from '@/lib/cn'
import { Price } from '@/ui/Price'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

/** Surface classes for the disabled or active button. */
function surfaceClass(isDisabled: boolean): string {
  if (isDisabled) {
    return 'bg-disabled-surface text-disabled'
  }

  return 'bg-[radial-gradient(circle,var(--color-lime-hi)_40%,var(--color-lime))] text-on-lime shadow-[inset_0_-3px_rgba(0,0,0,0.43)] hover:opacity-80 active:scale-[0.97] active:opacity-60'
}

interface GenerateButtonProps {
  onGenerate: () => void
  isGenerating: boolean
  isPriceLoading: boolean
  disabled: boolean
  error?: string
  price: number | null
  listPrice: number | null
  discount: number
}

function disabledTooltip(isDisabled: boolean, error?: string): string | null {
  if (isDisabled) {
    return error ?? null
  }

  return null
}

interface SpinningParams {
  isGenerating: boolean
  isPriceLoading: boolean
  isDisabled: boolean
}

function isSpinning(params: SpinningParams): boolean {
  const { isGenerating, isPriceLoading, isDisabled } = params

  return isGenerating || (isPriceLoading && !isDisabled)
}

/** Primary generate action with price, validation tooltip and in-flight spinner. */
export function GenerateButton(props: GenerateButtonProps) {
  const {
    isGenerating,
    isPriceLoading,
    disabled: isDisabled,
    error,
    price,
    listPrice,
    discount,
  } = props

  const isBusy = isSpinning({ isGenerating, isPriceLoading, isDisabled })
  const spinnerTone = isDisabled ? 'muted' : 'onAccent'
  const tooltip = disabledTooltip(isDisabled, error)

  return (
    <Tooltip content={tooltip}>
      <span className="block w-full">
        <button
          type="button"
          onClick={props.onGenerate}
          disabled={isDisabled || isGenerating}
          aria-busy={isBusy || undefined}
          className={cn(
            'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 pb-0.5 text-base font-semibold transition-transform duration-200',
            'disabled:pointer-events-none',
            surfaceClass(isDisabled),
          )}
        >
          Generate
          {isBusy && <Spinner size={16} tone={spinnerTone} />}
          {!isBusy && <Sparkles size={20} />}
          {!isNil(price) && !isDisabled && !isBusy && (
            <Price
              current={price}
              list={listPrice}
              discount={discount}
              format={formatUsd}
              tone="onAccent"
            />
          )}
        </button>
      </span>
    </Tooltip>
  )
}
