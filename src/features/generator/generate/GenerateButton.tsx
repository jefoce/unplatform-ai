'use client'

import { useId } from 'react'
import { isNil } from 'lodash-es'
import { Sparkles } from 'lucide-react'

import { formatEstimate, formatUsd } from '@/core/pricing/format'
import { cn } from '@/lib/cn'
import { Price } from '@/ui/Price'
import { Spinner } from '@/ui/Spinner'
import { Tooltip } from '@/ui/Tooltip'

import { generateSurfaceClass } from './generate-surface'

type GenerateButtonVariant = 'panel' | 'compact'

interface GenerateButtonProps {
  variant?: GenerateButtonVariant
  onGenerate: () => void
  isGenerating: boolean
  isPriceLoading: boolean
  disabled: boolean
  error?: string
  price: number | null
  listPrice?: number | null
  discount?: number
  isApproximate?: boolean
}

const WRAPPER_CLASSES: Record<GenerateButtonVariant, string> = {
  panel: 'block w-full',
  compact: 'block shrink-0',
}

const BUTTON_CLASSES: Record<GenerateButtonVariant, string> = {
  panel: 'h-12 w-full gap-2 px-4 pb-0.5 text-base font-semibold disabled:pointer-events-none',
  compact: 'h-20 w-30 flex-col gap-1',
}

interface PriceTextParams {
  usd: number | null
  isApproximate: boolean
}

function priceText(params: PriceTextParams): string | null {
  const { usd, isApproximate } = params

  if (isNil(usd)) {
    return null
  }

  const marker = isApproximate ? '~' : ''

  return `${marker}${formatUsd(usd)}`
}

/** Why the price is unknown, or null when the button can price the run. */
function priceHint(params: PriceHintParams): string | null {
  const { isPriceLoading, price } = params

  if (isPriceLoading) {
    return 'Getting price'
  }

  if (isNil(price)) {
    return 'Price unavailable'
  }

  return null
}

interface PriceHintParams {
  isPriceLoading: boolean
  price: number | null
}

interface PanelContentParams {
  isBusy: boolean
  isDisabled: boolean
  price: number | null
  listPrice: number | null
  discount: number
}

/** Full-width action for the generator panel. */
function panelContent(params: PanelContentParams) {
  const { isBusy: isWorking, isDisabled, price, listPrice, discount } = params
  const tone = isDisabled ? 'muted' : 'onAccent'
  const isPriceShown = !isNil(price) && !isWorking
  const format = isDisabled ? formatEstimate : formatUsd

  return (
    <>
      Generate
      {isWorking && <Spinner size={16} tone={tone} />}
      {!isWorking && <Sparkles size={20} />}
      {isPriceShown && (
        <Price
          current={price}
          list={listPrice}
          discount={discount}
          format={format}
          tone="onAccent"
        />
      )}
    </>
  )
}

interface CompactContentParams {
  isBusy: boolean
  isDisabled: boolean
  price: number | null
  isApproximate: boolean
}

/** Column action for the floating image prompt bar. */
function compactContent(params: CompactContentParams) {
  const { isBusy: isWorking, isDisabled, price, isApproximate } = params
  const tone = isDisabled ? 'muted' : 'onAccent'
  const label = priceText({ usd: price, isApproximate })
  const isPriceShown = !isNil(label) && !isWorking

  return (
    <>
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
        Generate
        {isWorking && <Spinner size={12} tone={tone} />}
      </span>
      {isPriceShown && (
        <span className="text-xs font-medium whitespace-nowrap tabular-nums">{label}</span>
      )}
    </>
  )
}

interface ButtonContentParams {
  isCompact: boolean
  isBusy: boolean
  isDisabled: boolean
  price: number | null
  listPrice: number | null
  discount: number
  isApproximate: boolean
}

function buttonContent(params: ButtonContentParams) {
  const { isCompact, isBusy, isDisabled, price, listPrice, discount, isApproximate } = params

  if (isCompact) {
    return compactContent({ isBusy, isDisabled, price, isApproximate })
  }

  return panelContent({ isBusy, isDisabled, price, listPrice, discount })
}

interface TooltipTextParams {
  isDisabled: boolean
  error?: string
  hint: string | null
}

function tooltipText(params: TooltipTextParams): string | null {
  const { isDisabled, error, hint } = params

  if (isDisabled) {
    return error ?? hint
  }

  return hint
}

function describedBy(ids: string[]): string | undefined {
  if (ids.length === 0) {
    return undefined
  }

  return ids.join(' ')
}

function busyValue(isWorking: boolean): boolean | undefined {
  if (isWorking) {
    return true
  }

  return undefined
}

function hintElement(text: string | null | undefined, hintId: string) {
  if (isNil(text)) {
    return null
  }

  return (
    <span id={hintId} className="sr-only">
      {text}
    </span>
  )
}

/** Primary generate action with price, validation tooltip and in-flight spinner. */
export function GenerateButton(props: GenerateButtonProps) {
  const {
    variant = 'panel',
    isGenerating,
    isPriceLoading,
    disabled: isDisabled,
    error,
    price,
  } = props

  const hint = priceHint({ isPriceLoading, price })
  const isWorking = isGenerating || isPriceLoading
  const isBlocked = isDisabled || !isNil(hint)
  const errorId = useId()
  const hintId = useId()

  const describedIds: string[] = []

  if (!isNil(error)) {
    describedIds.push(errorId)
  }

  if (!isNil(hint)) {
    describedIds.push(hintId)
  }

  return (
    <Tooltip content={tooltipText({ isDisabled, error, hint })}>
      <span className={WRAPPER_CLASSES[variant]}>
        <button
          type="button"
          onClick={props.onGenerate}
          disabled={isBlocked || isGenerating}
          aria-busy={busyValue(isWorking)}
          aria-describedby={describedBy(describedIds)}
          className={cn(
            'flex items-center justify-center rounded-xl transition-transform duration-200',
            BUTTON_CLASSES[variant],
            generateSurfaceClass(isBlocked),
          )}
        >
          {buttonContent({
            isCompact: variant === 'compact',
            isBusy: isWorking,
            isDisabled,
            price,
            listPrice: props.listPrice ?? null,
            discount: props.discount ?? 0,
            isApproximate: props.isApproximate ?? false,
          })}
        </button>
        {hintElement(error, errorId)}
        {hintElement(hint, hintId)}
      </span>
    </Tooltip>
  )
}
