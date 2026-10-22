'use client'

import { useCallback } from 'react'
import { isEmpty } from 'lodash-es'

import { BreadcrumbSegment } from './BreadcrumbSegment'

export interface FolderBreadcrumbsProps {
  folderName: string
  sub: string
  onNavigate: (sub: string) => void
}

/** Folder name plus clickable sub-path segments. */
export function FolderBreadcrumbs(props: FolderBreadcrumbsProps) {
  const { folderName, sub, onNavigate: handleNavigate } = props
  const segments = sub.split('/').filter(Boolean)
  const handleRoot = useCallback(() => handleNavigate(''), [handleNavigate])

  return (
    <nav className="flex min-w-0 scrollbar-none items-center gap-1 overflow-x-auto text-xs text-fg-2 [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={handleRoot}
        className={isEmpty(segments) ? 'shrink-0 text-fg' : 'shrink-0 transition hover:text-fg'}
      >
        {folderName}
      </button>
      {segments.map((segment, index) => {
        const target = segments.slice(0, index + 1).join('/')
        const isCurrent = index === segments.length - 1

        return (
          <BreadcrumbSegment
            key={target}
            label={segment}
            target={target}
            isCurrent={isCurrent}
            onNavigate={handleNavigate}
          />
        )
      })}
    </nav>
  )
}
