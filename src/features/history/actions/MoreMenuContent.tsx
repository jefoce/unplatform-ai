import { Copy, Film, FolderOpen, Frame, Hash, Trash2 } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { MoreMenuRow } from './MoreMenuRow'

interface MoreMenuContentProps {
  isCompleted: boolean
  hasFullVideoRefs: boolean
  onCaptureLast: () => void
  onCaptureFirst: () => void
  onAddReference: () => void
  onCopyPrompt: () => void
  onCopySeed: () => void
  onReveal: () => void
  onRemove: () => void
}

function handleCloseAutoFocus(event: Event): void {
  event.preventDefault()
}

/** Menu items for one record, in display order. */
export function MoreMenuContent(props: MoreMenuContentProps) {
  const { isCompleted, hasFullVideoRefs } = props

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align="end"
        sideOffset={6}
        onCloseAutoFocus={handleCloseAutoFocus}
        className="z-50 min-w-52 rounded-xl bg-page-2 p-2 shadow-[0_0_0_1px_var(--color-hover)]"
      >
        <MoreMenuRow
          icon={<Frame size={14} aria-hidden />}
          disabled={!isCompleted}
          onSelect={props.onCaptureLast}
        >
          Use last frame as start frame
        </MoreMenuRow>
        <MoreMenuRow
          icon={<Frame size={14} aria-hidden />}
          disabled={!isCompleted}
          onSelect={props.onCaptureFirst}
        >
          Use first frame as start frame
        </MoreMenuRow>
        <MoreMenuRow
          icon={<Film size={14} aria-hidden />}
          disabled={!isCompleted || hasFullVideoRefs}
          onSelect={props.onAddReference}
        >
          Add video as reference
        </MoreMenuRow>
        <DropdownMenuPrimitive.Separator className="my-1 h-px bg-divider" />
        <MoreMenuRow icon={<Copy size={14} aria-hidden />} onSelect={props.onCopyPrompt}>
          Copy prompt
        </MoreMenuRow>
        <MoreMenuRow icon={<Hash size={14} aria-hidden />} onSelect={props.onCopySeed}>
          Copy seed
        </MoreMenuRow>
        <MoreMenuRow
          icon={<FolderOpen size={14} aria-hidden />}
          disabled={!isCompleted}
          onSelect={props.onReveal}
        >
          Reveal in Finder
        </MoreMenuRow>
        <DropdownMenuPrimitive.Separator className="my-1 h-px bg-divider" />
        <MoreMenuRow icon={<Trash2 size={14} aria-hidden />} destructive onSelect={props.onRemove}>
          Delete
        </MoreMenuRow>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}
