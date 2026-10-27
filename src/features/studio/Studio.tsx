'use client'

import type { ReactNode } from 'react'

import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { HistorySection } from '@/features/history/list/HistorySection'
import { ingestDroppedPaths, routeFiles } from '@/features/media-input/route-files'
import { useWindowFileInput } from '@/features/media-input/use-window-file-input'
import { WindowDropOverlay } from '@/features/media-input/WindowDropOverlay'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import type { PreviewItem } from '@/features/preview/preview-store'
import { SettingsModal } from '@/features/settings/SettingsModal'
import { AppSection } from '@/features/updates/AppSection'
import { UpdateToast } from '@/features/updates/UpdateToast'
import { useUpdateCheck } from '@/features/updates/use-update-check'
import { ViewerUseButton } from '@/features/viewers/ViewerUseButton'
import { usePointerBlur } from '@/lib/use-pointer-blur'

/** Use button for the current preview item. */
function renderPreviewToolbar(item: PreviewItem): ReactNode {
  return <ViewerUseButton target={{ kind: 'upload', upload: item }} />
}

function handleWindowFiles(files: File[]): void {
  void routeFiles(files)
}

function handleWindowPaths(paths: string[]): void {
  void ingestDroppedPaths(paths)
}

/** Two-column studio shell: generate panel left, history right. */
export function Studio() {
  usePointerBlur()
  useUpdateCheck()

  const { isDragging, hint } = useWindowFileInput({
    onFiles: handleWindowFiles,
    onPaths: handleWindowPaths,
  })

  return (
    <>
      <main className="mx-auto flex h-dvh w-full max-w-480 gap-2 overflow-hidden px-4 py-2 max-compact:h-auto max-compact:flex-col">
        <aside className="flex max-h-full w-80 shrink-0 flex-col self-start overflow-hidden rounded-panel border border-line bg-page-2 max-compact:max-h-[min(720px,90vh)] max-compact:w-full">
          <GeneratorPanel />
        </aside>
        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-line-strong bg-page">
          <HistorySection />
        </section>
      </main>
      <WindowDropOverlay isDragging={isDragging} hint={hint} />
      <MediaPicker />
      <MediaPreviewModal toolbar={renderPreviewToolbar} />
      <SettingsModal appSection={<AppSection />} />
      <UpdateToast />
    </>
  )
}
