'use client'

export interface FolderCrumbButtonProps {
  label: string
  path: string
  onNavigate: (path: string) => void
}

/** One clickable segment in the folder path bar. */
export function FolderCrumbButton(props: FolderCrumbButtonProps) {
  const { label, path } = props

  const handleSelect = () => {
    props.onNavigate(path)
  }

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={handleSelect}
        className="max-w-32 truncate transition hover:text-fg"
      >
        {label}
      </button>
      <span>/</span>
    </span>
  )
}
