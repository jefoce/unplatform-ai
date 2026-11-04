'use client'

import { Settings } from 'lucide-react'

import { openSettings } from '@/features/settings/settings-store'

import { CreditsBadge } from '../credits/CreditsBadge'
import { WorkspaceSwitch } from './WorkspaceSwitch'

interface PanelHeaderProps {
  isKeyMissing: boolean
}

function handleOpenSettings(): void {
  openSettings()
}

/** Workspace switch, settings shortcut and credits for the generator panel. */
export function PanelHeader(props: PanelHeaderProps) {
  return (
    <div className="-mx-2 -mt-3.25 mb-6.25 flex h-12 items-center justify-between px-2">
      <WorkspaceSwitch />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Settings"
          onClick={handleOpenSettings}
          className="relative inline-flex size-7 items-center justify-center rounded-lg border border-white/8 bg-white/2 text-fg-2 hover:bg-hover hover:text-fg"
        >
          <Settings size={14} aria-hidden />
          {props.isKeyMissing && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-danger" />
          )}
        </button>
        <CreditsBadge />
      </div>
    </div>
  )
}
