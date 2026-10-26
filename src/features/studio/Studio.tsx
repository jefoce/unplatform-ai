'use client'

import { GeneratorPanel } from '@/features/generator/panel/GeneratorPanel'
import { HistorySection } from '@/features/history/list/HistorySection'
import { MediaPickerModal } from '@/features/media-picker/picker/MediaPickerModal'
import { MediaPreviewModal } from '@/features/preview/MediaPreviewModal'
import { SettingsModal } from '@/features/settings/SettingsModal'
import { AppSection } from '@/features/updates/AppSection'
import { UpdateToast } from '@/features/updates/UpdateToast'
import { useUpdateCheck } from '@/features/updates/use-update-check'
import { usePointerBlur } from '@/lib/use-pointer-blur'

/** Two-column studio shell: generate panel left, history right. */
export function Studio() {
  usePointerBlur()
  useUpdateCheck()

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
      <MediaPickerModal />
      <MediaPreviewModal />
      <SettingsModal appSection={<AppSection />} />
      <UpdateToast />
    </>
  )
}
