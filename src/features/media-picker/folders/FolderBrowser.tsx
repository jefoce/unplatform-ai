'use client'

import { ArrowUp } from 'lucide-react'

import type { BrowseResult } from '@/core/media-types'
import { Spinner } from '@/ui/Spinner'

import { DirectoryButton } from './DirectoryButton'
import { FolderCrumbButton } from './FolderCrumbButton'

interface FolderBrowserProps {
  path: string | null
  data: BrowseResult | null
  onNavigate: (path: string) => void
  onNavigateRoot: () => void
  onNavigateParent: () => void
}

interface FolderCrumb {
  label: string
  path: string
}

function crumbPaths(path: string): FolderCrumb[] {
  const parts = path.split('/').filter(Boolean)

  return parts.map((label, index) => {
    return {
      label,
      path: `/${parts.slice(0, index + 1).join('/')}`,
    }
  })
}

/** Path bar and directory list for the add-folder dialog. */
export function FolderBrowser(props: FolderBrowserProps) {
  const { path, data } = props
  const crumbs = crumbPaths(data?.path ?? path ?? '')

  return (
    <>
      <div className="mt-3 flex h-10 min-w-0 scrollbar-none items-center gap-0.5 overflow-x-auto rounded-lg bg-surface px-3 font-mono text-xs text-fg-2 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={props.onNavigateRoot}
          className="shrink-0 transition hover:text-fg"
        >
          /
        </button>
        {crumbs.map((crumb) => {
          return (
            <FolderCrumbButton
              key={crumb.path}
              label={crumb.label}
              path={crumb.path}
              onNavigate={props.onNavigate}
            />
          )
        })}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        {!data && (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        )}

        {Boolean(data?.parent) && (
          <button
            type="button"
            onClick={props.onNavigateParent}
            className="flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg"
          >
            <ArrowUp className="size-4" />
            ..
          </button>
        )}

        {data?.dirs.map((dir) => {
          return <DirectoryButton key={dir.path} dir={dir} onNavigate={props.onNavigate} />
        })}
      </div>
    </>
  )
}
