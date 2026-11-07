/** @public */
export const RESOLVED_TRANSPORTS = ['base64', 'url', 'upload'] as const

/** @public */
export const TRANSPORTS = [...RESOLVED_TRANSPORTS, 'auto'] as const

/** @public */
export type Transport = (typeof TRANSPORTS)[number]

/** @public */
export interface TransportByKind {
  image: Transport
  video: Transport
  audio: Transport
}
