import { isNil } from 'lodash-es'

const cache = new Map<string, boolean>()

/** Browser support for a media MIME type. SSR stays optimistic. */
export function canPlay(mime: string): boolean {
  if (typeof document === 'undefined') {
    return true
  }

  let isSupported = cache.get(mime)

  if (isNil(isSupported)) {
    const isAudio = mime.startsWith('audio/')
    const tag = isAudio ? 'audio' : 'video'
    const element = document.createElement(tag)

    isSupported = element.canPlayType(mime) !== ''
    cache.set(mime, isSupported)
  }

  return isSupported
}

/** Clears the MIME cache. Tests only. */
export function __resetCanPlayCache(): void {
  cache.clear()
}
