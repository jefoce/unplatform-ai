import type { GenerationRecord } from '@/core/types'

import { InputThumb } from './InputThumb'
import { thumbItems } from './thumb-item'

interface InputThumbsProps {
  record: GenerationRecord
}

/** Start/end frames and reference thumbs for one record. */
export function InputThumbs(props: InputThumbsProps) {
  const { record } = props
  const items = thumbItems(record)

  if (items.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <InputThumb key={`${item.label}-${item.id}`} item={item} index={index} />
      ))}
    </div>
  )
}
