'use client'

import { appVersion } from '@/core/app-version'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

const LICENSE_URL = 'https://github.com/jefoce/unplatform-ai/blob/HEAD/LICENSE'
const SOURCE_URL = 'https://github.com/jefoce/unplatform-ai'

const LINK_CLASSES = 'text-xxs text-fg-2 hover:text-fg hover:underline'

function handleLicense(): void {
  void platform.openExternal(LICENSE_URL).catch((error: unknown) => {
    toastError(error, 'Could not open the license')
  })
}

function handleSource(): void {
  void platform.openExternal(SOURCE_URL).catch((error: unknown) => {
    toastError(error, 'Could not open the source code')
  })
}

function handleNotices(): void {
  void platform.openNotices().catch((error: unknown) => {
    toastError(error, 'Could not open the notices')
  })
}

interface AboutSectionProps {
  version: string
}

/** License line and the license, source and notices links at the bottom of Settings. */
export function AboutSection(props: AboutSectionProps) {
  const shownVersion = appVersion() ?? props.version

  return (
    <div className="space-y-1 border-t border-line pt-3">
      <p className="text-xxs text-fg-2">Unplatform AI {shownVersion}, Copyright (c) 2026 jefoce</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={LINK_CLASSES} onClick={handleLicense}>
          Licensed under AGPL-3.0
        </button>
        <button type="button" className={LINK_CLASSES} onClick={handleSource}>
          Source code
        </button>
        <button type="button" className={LINK_CLASSES} onClick={handleNotices}>
          Third-party notices
        </button>
      </div>
    </div>
  )
}
