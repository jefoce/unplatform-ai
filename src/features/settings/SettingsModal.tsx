'use client'

import { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import useSWR from 'swr'

import type { CreditsInfo } from '@/core/types'
import { fetcher } from '@/lib/fetcher'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

import { useSettingsStore } from './settings-store'
import { SettingsBody } from './SettingsBody'
import { backendNote, useSecrets, useSettingsPrompt } from './use-secrets'
import { useSettingsDraft } from './use-settings-draft'

/** Stored key editor: status, save, remove and test. */
export function SettingsModal() {
  const isOpen = useSettingsStore((state) => state.open)
  const section = useSettingsStore((state) => state.section)
  const closeSettings = useSettingsStore((state) => state.closeSettings)
  const { status } = useSecrets()
  const { data: credits } = useSWR<CreditsInfo>('/api/credits', fetcher, {
    revalidateOnFocus: false,
  })
  const isMock = credits ? credits.source === 'mock' : undefined

  useSettingsPrompt(status, isMock)

  const draft = useSettingsDraft({ status, mock: isMock, closeSettings })
  const openrouterRef = useRef<HTMLElement>(null)
  const r2Ref = useRef<HTMLElement>(null)
  const note = backendNote(status?.backend)
  const handleOpenChange = draft.onClose
  const handleClose = useCallback(() => void handleOpenChange(false), [handleOpenChange])
  const handleSave = useCallback(() => void draft.onSave(), [draft])

  useEffect(() => {
    if (!isOpen) return

    const target = section === 'r2' ? r2Ref.current : openrouterRef.current

    target?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, section, status])

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      label="Settings"
      className="flex max-h-[85vh] w-[min(560px,92vw)] flex-col"
    >
      <header className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-fg">Settings</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          className="flex size-7 items-center justify-center rounded-lg text-fg-2 hover:bg-hover hover:text-fg"
        >
          <X size={15} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-3">
        <SettingsBody status={status} draft={draft} openrouterRef={openrouterRef} r2Ref={r2Ref} />
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <p className="text-xxs text-fg-2">{note}</p>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!draft.canSave}
            loading={draft.saving}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </footer>
    </Modal>
  )
}
