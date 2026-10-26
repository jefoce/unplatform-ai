interface CreditsRowProps {
  label: string
  value: string
  muted?: boolean
}

/** One label/value line in the credits popover. */
export function CreditsRow(props: CreditsRowProps) {
  const { label, value, muted: isMuted } = props
  const valueClass = isMuted === true ? 'text-right text-fg-2' : 'text-right text-fg'

  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-fg-2">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}
