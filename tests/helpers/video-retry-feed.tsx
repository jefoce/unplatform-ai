import { useMemo } from 'react'

import { ZOOM_DEFAULT } from '@/core/constants'
import { FeedContent } from '@/features/history/list/FeedContent'
import { useHistory } from '@/features/history/list/use-history'
import { videoItem } from '@/lib/feed/output-items'

function handleNoop(): void {}

/** Video feed with the real history hook wired to the shared feed content. */
export function VideoRetryFeed() {
  const history = useHistory()

  const items = useMemo(() => {
    return history.records.map(videoItem)
  }, [history.records])

  return (
    <FeedContent
      items={items}
      isLoading={history.isLoading}
      error={history.error}
      view="grid"
      zoom={ZOOM_DEFAULT}
      emptyKind="video"
      hasList={false}
      onOpen={handleNoop}
      onRetry={history.retry}
      onNearEnd={handleNoop}
    />
  )
}
