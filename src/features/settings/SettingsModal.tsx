'use client'

import { createRef, type ReactNode, type RefObject, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import useSWR from 'swr'
import { useShallow } from 'zustand/react/shallow'

import type { CreditsInfo } from '@/core/types'
import { fetchCredits } from '@/lib/api/credits'
import { CREDITS_KEY } from '@/lib/swr-keys'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'

import { SETTINGS_SECTION_IDS, type SettingsSection, useSettingsStore } from './settings-store'
import { SettingsBody } from './SettingsBody'
import { backendNote, useSecrets, useSettingsPrompt } from './use-secrets'
import { useSettingsDraft } from './use-settings-draft'

function createSectionRefs(): Record<SettingsSection, RefObject<HTMLElement | null>> {
  return Object.fromEntries(
    SETTINGS_SECTION_IDS.map((id) => {
      return [id, createRef<HTMLElement>()]
    }),
  ) as Record<SettingsSection, RefObject<HTMLElement | null>>
}

interface SettingsModalProps {
  appSection: ReactNode
}

/** Stored key editor: status, save, remove and test. */
export function SettingsModal(props: SettingsModalProps) {
  const { appSection } = props

  const { isOpen, section, closeSettings } = useSettingsStore(
    useShallow((state) => {
      return { isOpen: state.open, section: state.section, closeSettings: state.closeSettings }
    }),
  )

  const { status } = useSecrets()

  const { data: credits } = useSWR<CreditsInfo>(CREDITS_KEY, fetchCredits, {
    revalidateOnFocus: false,
  })

  const isMock = credits ? credits.source === 'mock' : undefined

  useSettingsPrompt(status, isMock)

  const draft = useSettingsDraft({ status, mock: isMock, closeSettings })

  const sectionRefs = useMemo(() => {
    return createSectionRefs()
  }, [])

  const note = backendNote(status?.backend)
  const { onClose } = draft

  const handleClose = () => {
    return void onClose(false)
  }

  const handleSave = () => {
    return void draft.onSave()
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const target = sectionRefs[section]

    target.current?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, section, sectionRefs, status])

  return (
    <Modal
      open={isOpen}
      onOpenChange={onClose}
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
        <SettingsBody
          status={status}
          draft={draft}
          sectionRefs={sectionRefs}
          appSection={appSection}
        />
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
