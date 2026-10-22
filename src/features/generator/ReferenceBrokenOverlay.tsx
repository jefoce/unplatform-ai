import { FileX, Link2Off } from 'lucide-react'

import { cn } from '@/lib/cn'

interface ReferenceBrokenOverlayProps {
  isMissing: boolean
}

/** Missing or deleted file overlay for a reference tile. */
export function ReferenceBrokenOverlay(props: ReferenceBrokenOverlayProps) {
  const { isMissing } = props

  return (
    <span
      aria-label={isMissing ? 'File missing' : 'File deleted'}
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-center',
        isMissing ? 'bg-danger/15 text-danger' : 'bg-page-2 text-fg-2',
      )}
    >
      {isMissing ? <Link2Off size={20} aria-hidden /> : <FileX size={20} aria-hidden />}
    </span>
  )
}
