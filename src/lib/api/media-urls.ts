import { isEmpty } from 'lodash-es'

import { THUMB_WIDTH } from '@/core/constants'
import { isNonEmptyString } from '@/core/guards'
import { canPlay } from '@/lib/media-support'

import { withQuery } from './query'

const encodeRef = (ref: string): string => {
  return ref.split('/').map(encodeURIComponent).join('/')
}

interface ThumbUrlParams {
  ref: string
  w?: number
}

/** Media stream URL, routed through the compat copy when the MIME cannot play. */
export function mediaUrl(ref: string, mime?: string): string {
  const [pathRef = ref, query = ''] = ref.split('?')
  const base = `/api/media/${encodeRef(pathRef)}`
  const isPlainUrl = isEmpty(query)

  const plainUrl = isPlainUrl ? base : `${base}?${query}`

  if (!isNonEmptyString(mime) || canPlay(mime)) {
    return plainUrl
  }

  const params = new URLSearchParams(query)

  params.set('compat', '1')

  return `${base}?${params.toString()}`
}

/** Thumbnail URL for a ref, encoding each path segment. */
export function thumbUrl(params: ThumbUrlParams): string {
  const { ref, w = THUMB_WIDTH } = params

  return withQuery(`/api/thumbs/${encodeRef(ref)}`, { w })
}

/** Download URL for a stored video file, optionally forcing a download. */
export function downloadMediaUrl(file: string, isDownload = false): string {
  const base = `/api/media/downloads/${file}`

  if (isDownload) {
    return `${base}?download=1`
  }

  return base
}

export function uploadThumbUrl(id: string, width = 160): string {
  return `/api/thumbs/uploads/${id}?w=${width}`
}
