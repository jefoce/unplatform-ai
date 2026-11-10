'use client'

import type { ReactNode } from 'react'

import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { HistorySection } from '@/features/history/list/HistorySection'
import { ImagePromptBar } from '@/features/image-generator/ImagePromptBar'
import { ingestDroppedPaths, routeFiles } from '@/features/media-input/route-files'
import { useWindowFileInput } from '@/features/media-input/use-window-file-input'
import { WindowDropOverlay } from '@/features/media-input/WindowDropOverlay'
import { MediaPicker } from '@/features/media-picker/picker/MediaPicker'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import type { PreviewItem } from '@/features/preview/preview-store'
import { SettingsModal } from '@/features/settings/SettingsModal'
import { EndpointsStatusProvider } from '@/features/shared/endpoints-status-context'
import { useWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { AppSection } from '@/features/updates/AppSection'
import { UpdateToast } from '@/features/updates/UpdateToast'
import { useUpdateCheck } from '@/features/updates/use-update-check'
import { ViewerUseButton } from '@/features/viewers/ViewerUseButton'
import { ImageWorkspace } from '@/features/workspace/ImageWorkspace'
import { useImageWorkspaceItems } from '@/features/workspace/use-image-workspace-items'
import { usePointerBlur } from '@/lib/use-pointer-blur'

import { JobWatcher } from './JobWatcher'
import { IMAGE_LAYOUT, VIDEO_LAYOUT } from './layout'

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

/** Studio shell: video generator and history, or the image workspace. */
export function Studio() {
  const tab = useWorkspaceTab()
  const imageWorkspace = useImageWorkspaceItems()

  usePointerBlur()
  useUpdateCheck()

  const { isDragging, hint } = useWindowFileInput({
    onFiles: handleWindowFiles,
    onPaths: handleWindowPaths,
    workspace: tab,
  })

  const isImage = tab === 'image'
  const layout = isImage ? IMAGE_LAYOUT : VIDEO_LAYOUT

  return (
    <EndpointsStatusProvider>
      <JobWatcher imageRecords={imageWorkspace.records}>
        <main className={layout}>
          {isImage && (
            <ImageWorkspace
              {...imageWorkspace}
              promptBar={<ImagePromptBar activeCount={imageWorkspace.activeCount} />}
            />
          )}
          {!isImage && (
            <>
              <aside className="flex max-h-full w-80 shrink-0 flex-col self-start overflow-hidden rounded-panel border border-line bg-page-2 max-compact:max-h-[min(720px,90vh)] max-compact:w-full">
                <GeneratorPanel />
              </aside>
              <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-panel border border-line-strong bg-page">
                <HistorySection />
              </section>
            </>
          )}
        </main>
        <WindowDropOverlay isDragging={isDragging} hint={hint} />
        <MediaPicker />
        <MediaPreviewModal toolbar={renderPreviewToolbar} />
        <SettingsModal appSection={<AppSection />} />
        <UpdateToast />
      </JobWatcher>
    </EndpointsStatusProvider>
  )
}
