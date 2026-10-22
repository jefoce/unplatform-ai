'use client'

import { Image as ImageIcon, Music, Video } from 'lucide-react'

import type { RefSlot } from '@/core/prompt-tokens'

const ICONS = {
  image: ImageIcon,
  video: Video,
  audio: Music,
}

interface ReferenceIconProps {
  kind: RefSlot['kind']
  size: number
}

/** Kind glyph shared by reference chips and the mention typeahead. */
export function ReferenceIcon(props: ReferenceIconProps) {
  const { kind, size } = props
  const Icon = ICONS[kind]

  return <Icon size={size} />
}
