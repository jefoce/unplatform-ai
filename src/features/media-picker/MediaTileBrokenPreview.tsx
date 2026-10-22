'use client'

import { Film, Image as ImageIcon } from 'lucide-react'

import type { MediaKind } from '@/core/types'

interface MediaTileBrokenPreviewProps {
  kind: MediaKind
}

/** Fallback icon when a thumbnail fails. */
export function MediaTileBrokenPreview(props: MediaTileBrokenPreviewProps) {
  const { kind } = props

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/5 text-fg-2">
      {kind === 'video' ? <Film size={24} aria-hidden /> : <ImageIcon size={24} aria-hidden />}
    </span>
  )
}
