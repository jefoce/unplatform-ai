import { Film, Image as ImageIcon, type LucideIcon } from 'lucide-react'

import type { RecordKind } from '@/core/feed/grid-item'

interface EmptyStateProps {
  kind: RecordKind
}

interface EmptyCopy {
  title: string
  body: string
}

const COPY: Record<RecordKind, EmptyCopy> = {
  video: { title: 'No generations yet', body: 'Generated videos will appear here.' },
  image: { title: 'No images yet', body: 'Generated images will appear here.' },
}

const ICONS: Record<RecordKind, LucideIcon> = {
  video: Film,
  image: ImageIcon,
}

/** Empty copy and icon for the video or image feed. */
export function EmptyState(props: EmptyStateProps) {
  const { kind } = props
  const copy = COPY[kind]
  const Icon = ICONS[kind]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <Icon size={20} className="text-fg-2" aria-hidden />
      <p className="text-sm font-medium text-fg">{copy.title}</p>
      <p className="text-xs text-fg-2">{copy.body}</p>
    </div>
  )
}
