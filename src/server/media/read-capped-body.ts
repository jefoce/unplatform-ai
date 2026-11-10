import 'server-only'

import { isNil } from 'lodash-es'

/** A response body over the caller's byte cap. */
export class BodyTooLargeError extends Error {
  constructor() {
    super('Body is larger than the limit')
    this.name = 'BodyTooLargeError'
  }
}

/** Reads at most `capBytes`, so an unbounded body never reaches the parser. */
export async function readCappedBody(res: Response, capBytes: number): Promise<Buffer> {
  if (isNil(res.body)) {
    return Buffer.from(await res.arrayBuffer())
  }

  const chunks: Buffer[] = []
  let total = 0
  const reader = res.body.getReader()

  for (;;) {
    const { done: isDone, value } = await reader.read()

    if (isDone) {
      break
    }

    total += value.byteLength

    if (total > capBytes) {
      await reader.cancel()

      throw new BodyTooLargeError()
    }

    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, total)
}
