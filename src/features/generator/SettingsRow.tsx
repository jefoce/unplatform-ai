'use client'

import { AspectRatioPopover } from './AspectRatioPopover'
import { DurationPopover } from './DurationPopover'
import { ResolutionPopover } from './ResolutionPopover'

/** Duration, aspect ratio and resolution controls. */
export function SettingsRow() {
  return (
    <div className="mt-2 flex gap-2">
      <DurationPopover />
      <AspectRatioPopover />
      <ResolutionPopover />
    </div>
  )
}
