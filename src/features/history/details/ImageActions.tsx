'use client'

import type { ImageGridItem } from '@/lib/feed/output-items'
import { formatDate } from '@/lib/format'
import { Button } from '@/ui/Button'

import { reuseImagePrompt } from '../actions/image-actions'
import { imageCardActions } from '../actions/image-card-actions'
import { MoreMenu } from '../actions/MoreMenu'
import { useCardActions } from '../actions/use-card-actions'
import { DetailsActionIconButton } from './DetailsActionIconButton'

const MENU_CLASSES = 'ml-auto h-6 w-7.5 rounded-lg border-0 bg-transparent text-fg-2'

interface ImageActionsProps {
  item: ImageGridItem
  onDeleted?: () => void
}

/** Date, reuse and the shared per-kind image actions in a details footer. */
export function ImageActions(props: ImageActionsProps) {
  const { item } = props
  const actions = imageCardActions(item)
  const { handleSelect, confirmDialog } = useCardActions(props.onDeleted)

  const handleReuse = () => {
    void reuseImagePrompt(item)
  }

  return (
    <>
      <div className="relative mt-auto h-6 shrink-0">
        <div className="flex h-6 items-center justify-between text-xs text-fg-2 transition-opacity duration-150 group-hover/card:pointer-events-none group-hover/card:opacity-0 group-has-focus-visible/card:pointer-events-none group-has-focus-visible/card:opacity-0 group-has-data-[state=open]/card:pointer-events-none group-has-data-[state=open]/card:opacity-0">
          <span>{formatDate(item.createdAt)}</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex h-6 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-focus-visible/card:pointer-events-auto group-has-focus-visible/card:opacity-100 group-has-data-[state=open]/card:pointer-events-auto group-has-data-[state=open]/card:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            className="h-5.5 rounded-md px-4 text-xxs font-semibold text-fg hover:bg-hover"
            onClick={handleReuse}
          >
            Reuse
          </Button>
          {actions.map((action) => {
            return (
              <DetailsActionIconButton key={action.key} action={action} onSelect={handleSelect} />
            )
          })}
          <MoreMenu item={item} onDeleted={props.onDeleted} className={MENU_CLASSES} />
        </div>
      </div>
      {confirmDialog}
    </>
  )
}
