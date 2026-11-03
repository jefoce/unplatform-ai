'use client'

import { type ReactNode, useMemo } from 'react'
import { uniqBy } from 'lodash-es'

import { type ImageRecord, isImageActive } from '@/core/schemas/image-record'
import { HistoryContext, useHistory } from '@/features/history/list/use-history'
import { useJobNotifications } from '@/features/history/status/use-job-notifications'
import { useActiveImageWatch } from '@/features/workspace/use-active-image-watch'

export interface JobWatcherProps {
  imageRecords: ImageRecord[]
  children: ReactNode
}

/** Watches both job kinds and provides the history feed, whichever tab is shown. */
export function JobWatcher(props: JobWatcherProps) {
  const { imageRecords, children } = props
  const history = useHistory()
  const watch = useActiveImageWatch(imageRecords)

  const watchedImages = useMemo(() => {
    return uniqBy([...watch.records, ...imageRecords], 'id')
  }, [imageRecords, watch.records])

  const imageActive = watchedImages.filter(isImageActive).length
  const activeCount = history.activeCount + Math.max(watch.activeCount, imageActive)

  useJobNotifications({
    records: history.records,
    imageRecords: watchedImages,
    activeCount,
    isLoading: history.isLoading,
  })

  return <HistoryContext.Provider value={history}>{children}</HistoryContext.Provider>
}
