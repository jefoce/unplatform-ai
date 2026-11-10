interface ModelDescriptionProps {
  description: string
}

/** Two-line clamped model description, full text available in the tooltip. */
export function ModelDescription(props: ModelDescriptionProps) {
  const { description } = props

  if (description === '') {
    return null
  }

  return (
    <span className="mt-1 line-clamp-2 text-xs text-fg-2" title={description}>
      {description}
    </span>
  )
}
