'use client'

import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'
import { renderReleaseNotes } from '@/lib/release-notes'

interface AppNotesProps {
  statusText: string
  isDanger: boolean
  notes: string
  onOpenRelease: () => void
}

const LINK_CLASSES = 'text-xxs text-fg-2 hover:text-fg hover:underline'

function handleOpenLink(url: string): void {
  void platform.openExternal(url).catch((error: unknown) => {
    toastError(error, 'Could not open the link')
  })
}

/** Update status, truncated release notes and the release page link. */
export function AppNotes(props: AppNotesProps) {
  const { statusText, isDanger, notes } = props
  const statusClassName = isDanger ? 'text-xxs text-danger' : 'text-xxs text-fg-2'

  return (
    <>
      <p aria-live="polite" className={statusClassName}>
        {statusText}
      </p>

      {Boolean(notes) && (
        <div className="space-y-1 text-xxs text-fg-3">
          {renderReleaseNotes(notes, handleOpenLink)}
        </div>
      )}

      <button type="button" className={LINK_CLASSES} onClick={props.onOpenRelease}>
        Release notes
      </button>
    </>
  )
}
