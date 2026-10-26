import { FileX, Link2Off } from 'lucide-react'

import { cn } from '@/lib/cn'

interface ReferenceBrokenOverlayProps {
  isMissing: boolean
}

/** Missing or deleted file overlay for a reference tile. */
export function ReferenceBrokenOverlay(props: ReferenceBrokenOverlayProps) {
  const { isMissing } = props
  const label = isMissing ? 'File missing' : 'File deleted'
  const Icon = isMissing ? Link2Off : FileX

  return (
    <span
      aria-label={label}
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-center',
        isMissing && 'bg-danger/15 text-danger',
        !isMissing && 'bg-page-2 text-fg-2',
      )}
    >
      <Icon size={20} aria-hidden />
    </span>
  )
}
