'use client'

import { AspectRatioPopover } from '../options/AspectRatioPopover'
import { DurationPopover } from '../options/DurationPopover'
import { ResolutionPopover } from '../options/ResolutionPopover'

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
