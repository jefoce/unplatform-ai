import { isNil } from 'lodash-es'

/** "15% off" for a fractional discount. */
export function discountLabel(discount: number): string {
  return `${Math.round(discount * 100)}% off`
}

type PriceTone = 'default' | 'onAccent' | 'muted'

interface ToneClasses {
  current: string
  currentFlat: string
  list: string
  discount: string
}

const TONE_CLASSES: Record<PriceTone, ToneClasses> = {
  default: {
    current: 'text-lime',
    currentFlat: 'text-fg-2',
    list: 'text-fg-3 line-through',
    discount: 'text-lime',
  },
  onAccent: {
    current: 'text-on-lime',
    currentFlat: 'text-on-lime',
    list: 'text-on-lime/50 line-through',
    discount: 'text-on-lime/70',
  },
  muted: {
    current: 'text-disabled',
    currentFlat: 'text-disabled',
    list: 'text-disabled/50 line-through',
    discount: 'text-disabled/70',
  },
}

interface PriceProps {
  current: number
  list?: number | null
  discount?: number
  format: (value: number) => string
  tone?: PriceTone
  showDiscountLabel?: boolean
}

/** Struck list price, effective price and percent off, shared by every price display. */
export function Price(props: PriceProps) {
  const {
    current,
    list,
    discount = 0,
    format,
    tone = 'default',
    showDiscountLabel: shouldShowDiscountLabel = false,
  } = props

  const classes = TONE_CLASSES[tone]
  const isDiscounted = discount > 0
  const currentClass = isDiscounted ? classes.current : classes.currentFlat

  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
      {!isNil(list) && list !== current && <span className={classes.list}>{format(list)}</span>}
      <span className={currentClass}>{format(current)}</span>
      {shouldShowDiscountLabel && isDiscounted && (
        <span className={classes.discount}>{discountLabel(discount)}</span>
      )}
    </span>
  )
}
