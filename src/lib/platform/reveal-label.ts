import { isString } from 'lodash-es'

import type { Dict } from '@/core/utility-types'

const REVEAL_LABELS: Dict<string> = {
  darwin: 'Reveal in Finder',
  win32: 'Show in Explorer',
  linux: 'Show in folder',
}

/** Platform id from the browser user agent, for the first paint before capabilities load. */
function browserPlatform(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }

  if (/Windows/i.test(navigator.userAgent)) {
    return 'win32'
  }

  if (/Macintosh|Mac OS/i.test(navigator.userAgent)) {
    return 'darwin'
  }

  if (/Linux|X11/i.test(navigator.userAgent)) {
    return 'linux'
  }

  return undefined
}

/** File manager reveal label for a Node platform id. */
export function revealLabel(platform?: string): string {
  if (isString(platform)) {
    return REVEAL_LABELS[platform] ?? 'Show in folder'
  }

  const detected = browserPlatform()

  if (!isString(detected)) {
    return 'Show in folder'
  }

  return REVEAL_LABELS[detected] ?? 'Show in folder'
}
