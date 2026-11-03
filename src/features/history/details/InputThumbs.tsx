import { InputThumb } from './InputThumb'
import type { ThumbItem } from './thumb-item'

interface InputThumbsProps {
  items: ThumbItem[]
}

/** Input thumbs for one record, in display order. */
export function InputThumbs(props: InputThumbsProps) {
  const { items } = props

  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => {
        return (
          <InputThumb key={`${item.label}-${item.id}`} item={item} items={items} index={index} />
        )
      })}
    </div>
  )
}
