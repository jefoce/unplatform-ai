'use client'

import { Film, Image as ImageIcon } from 'lucide-react'

import type { MediaKind } from '@/core/media-types'

interface MediaTileBrokenPreviewProps {
  kind: MediaKind
}

/** Fallback icon when a thumbnail fails. */
export function MediaTileBrokenPreview(props: MediaTileBrokenPreviewProps) {
  const { kind } = props
  const Icon = kind === 'video' ? Film : ImageIcon

  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/5 text-fg-2">
      <Icon size={24} aria-hidden />
    </span>
  )
}
