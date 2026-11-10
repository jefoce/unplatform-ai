'use client'

import { isOneOf } from '@/core/guards'
import {
  CUSTOM_ENDPOINT_PRICING_MODES,
  type CustomEndpointPricing,
  type CustomEndpointPricingMode,
} from '@/core/schemas/custom-endpoint'
import { Field } from '@/ui/form/Field'
import { NumberInput } from '@/ui/form/NumberInput'
import { OptionPopover } from '@/ui/OptionPopover'

const PRICE_LABELS = {
  model: 'Use model price',
  free: 'Free',
  perRun: 'Per run $',
  perSecond: 'Per second $',
} satisfies Record<CustomEndpointPricingMode, string>

interface EndpointPriceFieldProps {
  pricing: CustomEndpointPricing
  onChange: (pricing: CustomEndpointPricing) => void
}

/** Price mode and, for per run or per second, the USD amount. */
export function EndpointPriceField(props: EndpointPriceFieldProps) {
  const { pricing } = props
  const isUsdVisible = pricing.mode === 'perRun' || pricing.mode === 'perSecond'

  const handleMode = (value: string) => {
    if (!isOneOf(CUSTOM_ENDPOINT_PRICING_MODES, value)) {
      return
    }

    props.onChange({ ...pricing, mode: value })
  }

  const handleUsd = (value: number | null) => {
    props.onChange({ ...pricing, usd: value ?? 0 })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <span className="block text-xs font-medium text-fg">Price</span>
        <OptionPopover
          label="Price"
          options={CUSTOM_ENDPOINT_PRICING_MODES}
          labels={PRICE_LABELS}
          value={pricing.mode}
          onValueChange={handleMode}
        />
      </div>
      {isUsdVisible && (
        <Field label="Price in USD">
          <NumberInput value={pricing.usd} min={0} onValueChange={handleUsd} />
        </Field>
      )}
    </div>
  )
}
