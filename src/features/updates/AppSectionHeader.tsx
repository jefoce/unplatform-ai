interface AppSectionHeaderProps {
  version: string
}

/** App heading and version line shared by the browser and desktop sections. */
export function AppSectionHeader(props: AppSectionHeaderProps) {
  const { version } = props

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold tracking-wide text-fg-2 uppercase">App</h3>
      <p className="text-xxs text-fg-2">Unplatform AI {version}</p>
    </div>
  )
}
