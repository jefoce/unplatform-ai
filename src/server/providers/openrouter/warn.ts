import 'server-only'

type PricingFallbackKind = 'discount' | 'list'

interface PricingWarningParams {
  label: string
  modelId: string
  reason: string
  kind: PricingFallbackKind
}

/** One pricing fallback warning, never the URL or headers. */
export function warnFallback(params: PricingWarningParams): void {
  const { label, modelId, reason, kind } = params

  console.warn(`[pricing] ${label} (${modelId}) ${kind} fallback: ${reason}`)
}
