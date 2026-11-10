interface EndpointBadgeProps {
  badge: string
}

/** Endpoint badge chip shared by settings, picker and history details. */
export function EndpointBadge(props: EndpointBadgeProps) {
  const { badge } = props

  return (
    <span
      data-endpoint-badge=""
      className="flex h-6 w-10 shrink-0 items-center justify-center rounded-md bg-white/5 font-mono text-xxs text-fg-2"
    >
      {badge}
    </span>
  )
}
