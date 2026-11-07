'use client'

import { RefreshCw } from 'lucide-react'

import { Spinner } from '@/ui/Spinner'

interface ModelRefreshButtonProps {
  isFetching: boolean
  onRefresh: () => void
}

/** Refresh control that swaps to a spinner while the catalog loads. */
export function ModelRefreshButton(props: ModelRefreshButtonProps) {
  const { isFetching } = props
  let icon = <RefreshCw size={14} aria-hidden />

  if (isFetching) {
    icon = <Spinner size={14} />
  }

  return (
    <button
      type="button"
      aria-label="Refresh models"
      onClick={props.onRefresh}
      disabled={isFetching}
      className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-md text-fg-2 transition hover:bg-hover hover:text-fg disabled:pointer-events-none"
    >
      {icon}
    </button>
  )
}
