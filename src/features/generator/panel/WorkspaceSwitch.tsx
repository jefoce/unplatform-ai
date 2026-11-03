'use client'

import { isOneOf } from '@/core/guards'
import {
  setWorkspaceTab,
  useWorkspaceTab,
  WORKSPACE_TAB_OPTIONS,
  WORKSPACE_TABS,
} from '@/features/shared/use-workspace-tab'
import { SegmentedTabs } from '@/ui/SegmentedTabs'

function handleTab(value: string): void {
  if (isOneOf(WORKSPACE_TABS, value)) {
    setWorkspaceTab(value)
  }
}

/** Video / Image workspace switch in the generator header. */
export function WorkspaceSwitch() {
  const tab = useWorkspaceTab()

  return (
    <SegmentedTabs
      options={WORKSPACE_TAB_OPTIONS}
      value={tab}
      onValueChange={handleTab}
      size="sm"
      className="ml-1 w-36"
    />
  )
}
