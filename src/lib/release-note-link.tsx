'use client'

import type { MouseEvent, ReactElement } from 'react'

interface ReleaseNoteLinkProps {
  url: string
  label: string
  onOpen: (url: string) => void
}

const LINK_CLASSES = 'underline hover:text-fg'

/** One allowed link in the release notes. Opens through the caller, never navigates the webview. */
export function ReleaseNoteLink(props: ReleaseNoteLinkProps): ReactElement {
  const { url, label } = props

  const handleOpen = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault()
    props.onOpen(url)
  }

  return (
    <a className={LINK_CLASSES} href={url} onClick={handleOpen}>
      {label}
    </a>
  )
}
