'use client'

interface AppNotesProps {
  statusText: string
  isDanger: boolean
  notes: string
  onOpenRelease: () => void
}

const LINK_CLASSES = 'text-xxs text-fg-2 hover:text-fg hover:underline'

/** Update status, truncated release notes and the release page link. */
export function AppNotes(props: AppNotesProps) {
  const { statusText, isDanger, notes } = props
  const statusClassName = isDanger ? 'text-xxs text-danger' : 'text-xxs text-fg-2'

  return (
    <>
      <p aria-live="polite" className={statusClassName}>
        {statusText}
      </p>

      {Boolean(notes) && <p className="text-xxs whitespace-pre-line text-fg-3">{notes}</p>}

      <button type="button" className={LINK_CLASSES} onClick={props.onOpenRelease}>
        Release notes
      </button>
    </>
  )
}
