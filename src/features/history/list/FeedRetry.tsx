import { ApiError } from '@/lib/fetcher'
import { Button } from '@/ui/Button'

interface FeedRetryProps {
  error: unknown
  onRetry: () => void
}

/** Retry copy for a first page that failed before any item loaded. */
export function FeedRetry(props: FeedRetryProps) {
  const { error } = props
  const isSessionLost = error instanceof ApiError && error.status === 401
  const message = isSessionLost ? 'Session lost. Restart the app.' : "Couldn't load."

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium text-fg">{message}</p>
      {!isSessionLost && (
        <Button size="sm" variant="outline" onClick={props.onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
