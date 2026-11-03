import { useMemo } from 'react'

import { ZOOM_DEFAULT } from '@/core/constants'
import { FeedContent } from '@/features/history/list/FeedContent'
import { imageItems } from '@/lib/feed/output-items'
import { useImagePages } from '@/lib/use-image-pages'

function handleNoop(): void {}

/** Image feed with the real page hook wired to the shared feed content. */
export function ImageRetryFeed() {
  const pages = useImagePages({ filters: {} })

  const items = useMemo(() => {
    return pages.records.flatMap((record) => {
      return imageItems(record)
    })
  }, [pages.records])

  const handleRetry = () => {
    void pages.mutate()
  }

  return (
    <FeedContent
      items={items}
      isLoading={pages.isLoading}
      error={pages.error}
      view="grid"
      zoom={ZOOM_DEFAULT}
      emptyKind="image"
      hasList={false}
      onOpen={handleNoop}
      onRetry={handleRetry}
      onNearEnd={handleNoop}
    />
  )
}
