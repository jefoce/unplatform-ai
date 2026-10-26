import 'server-only'

import { REMOTE_FREE_GB, REMOTE_LINK_TTL_SEC, REMOTE_MAX_GB } from '@/core/constants'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export class RequestBodyError extends HttpError {
  constructor() {
    super(400, 'Invalid JSON body')
  }
}

export class ValidationError extends Error {
  readonly status = 400
  readonly errors: string[]

  constructor(errors: string[]) {
    super(errors[0] ?? 'Invalid input')
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export class UploadError extends HttpError {}

/** Nothing evictable can make room for a new tracked object. */
export class RemoteCapError extends HttpError {
  constructor() {
    const hours = REMOTE_LINK_TTL_SEC / 3600

    super(
      507,
      `R2 is at the app's ${REMOTE_MAX_GB} GB limit, which keeps it inside the free ${REMOTE_FREE_GB} GB. References used in the last ${hours} hours cannot be removed yet. Try again later, or use shorter clips.`,
    )
  }
}
