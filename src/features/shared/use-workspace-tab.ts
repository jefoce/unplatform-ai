'use client'

import { useSyncExternalStore } from 'react'

import { isOneOf } from '@/core/guards'
import type { SegmentedTabOption } from '@/ui/SegmentedTab'

export const WORKSPACE_TABS = ['video', 'image'] as const
export type WorkspaceTab = (typeof WORKSPACE_TABS)[number]

export const WORKSPACE_TAB_OPTIONS: SegmentedTabOption[] = [
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
]

const TAB_EVENT = 'unplatform-ai:workspace-tab'

/** Tab from `?tab=`, video when absent or unknown. */
const readTab = (): WorkspaceTab => {
  const value = new URLSearchParams(window.location.search).get('tab')

  if (isOneOf(WORKSPACE_TABS, value)) {
    return value
  }

  return 'video'
}

/** Tab read at call time, for imperative routing. */
export function currentWorkspaceTab(): WorkspaceTab {
  return readTab()
}

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('popstate', onChange)
  window.addEventListener(TAB_EVENT, onChange)

  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(TAB_EVENT, onChange)
  }
}

/** Writes the tab to the URL without a navigation or reload. */
export function setWorkspaceTab(tab: WorkspaceTab): void {
  const url = new URL(window.location.href)

  if (tab === 'video') {
    url.searchParams.delete('tab')
  } else {
    url.searchParams.set('tab', tab)
  }

  window.history.replaceState(null, '', url.toString())
  window.dispatchEvent(new Event(TAB_EVENT))
}

/** Current workspace tab, kept in the URL so a reload returns to it. */
export function useWorkspaceTab(): WorkspaceTab {
  return useSyncExternalStore(subscribe, readTab, () => {
    return 'video'
  })
}
