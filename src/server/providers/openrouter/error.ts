import 'server-only'

export interface OpenRouterErrorParams {
  message: string
  status: number
  code?: string
  details?: string[]
}

export class OpenRouterError extends Error {
  constructor(params: OpenRouterErrorParams) {
    const { message, status, code, details } = params

    super(message)
    this.name = 'OpenRouterError'
    this.status = status
    this.code = code
    this.details = details
  }

  readonly status: number
  readonly code?: string
  readonly details?: string[]
}
