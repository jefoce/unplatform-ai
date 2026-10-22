interface CreditsRowProps {
  label: string
  value: string
  muted?: boolean
}

/** One label/value line in the credits popover. */
export function CreditsRow(props: CreditsRowProps) {
  const { label, value, muted: isMuted } = props

  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-fg-2">{label}</span>
      <span className={isMuted === true ? 'text-right text-fg-2' : 'text-right text-fg'}>
        {value}
      </span>
    </div>
  )
}
