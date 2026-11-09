/** Exact output sizes keyed by any aspect string the endpoint offers. */
export type SizeByAspect = Partial<Record<string, `${number}x${number}`>>

/** Exact output sizes keyed by any resolution string the endpoint offers. */
export type OutputSizes = Partial<Record<string, SizeByAspect>>
