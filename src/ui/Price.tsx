import { isNil } from 'lodash-es'

/** "15% off" for a fractional discount, null below one percent. */
export function discountLabel(discount: number): string | null {
  if (discount < 0.01) {
    return null
  }

  return `${Math.round(discount * 100)}% off`
}

type PriceTone = 'default' | 'onAccent'

interface ToneClasses {
  current: string
  currentFlat: string
  list: string
  discount: string
}

const TONE_CLASSES: Record<PriceTone, ToneClasses> = {
  default: {
    current: 'text-accent',
    currentFlat: 'text-fg-2',
    list: 'text-fg-3 line-through',
    discount: 'text-accent',
  },
  onAccent: {
    current: 'text-on-accent',
    currentFlat: 'text-on-accent',
    list: 'text-on-accent/50 line-through',
    discount: 'text-on-accent/70',
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
  const label = discountLabel(discount)

  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums">
      {!isNil(list) && list !== current && <span className={classes.list}>{format(list)}</span>}
      <span className={currentClass}>{format(current)}</span>
      {shouldShowDiscountLabel && !isNil(label) && (
        <span className={classes.discount}>{label}</span>
      )}
    </span>
  )
}
