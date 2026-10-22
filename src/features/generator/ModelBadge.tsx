import type { LucideIcon } from 'lucide-react'

interface ModelBadgeProps {
  icon: LucideIcon
  text?: string
  label?: string
}

/** Capability badge in a model row. */
export function ModelBadge(props: ModelBadgeProps) {
  const { icon: Icon, text, label } = props

  return (
    <span
      aria-label={label}
      className="inline-flex h-6 items-center gap-1 rounded-md bg-white/5 px-1.5 text-xs text-fg-2"
    >
      <Icon size={12} />
      {text}
    </span>
  )
}
