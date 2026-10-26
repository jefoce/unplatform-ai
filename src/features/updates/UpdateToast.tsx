'use client'

import { useEffect } from 'react'
import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { platform } from '@/lib/platform'

import { useUpdateStore } from './update-store'
import { useInstallUpdate } from './use-install-update'

const TOAST_DURATION_MS = 20_000

/** Shows the update notice once while an update is available and not dismissed. */
export function UpdateToast() {
  const status = useUpdateStore((state) => {
    return state.status
  })

  const update = useUpdateStore((state) => {
    return state.update
  })

  const isDismissed = useUpdateStore((state) => {
    return state.isDismissed
  })

  const installKind = useUpdateStore((state) => {
    return state.appInfo?.installKind
  })

  const dismiss = useUpdateStore((state) => {
    return state.dismiss
  })

  const install = useInstallUpdate()
  const isVisible = status === 'available' && !isNil(update) && !isDismissed

  useEffect(() => {
    if (!isVisible || isNil(update)) {
      return
    }

    const isLinuxPackage = installKind === 'linux-package'

    const handleDownload = () => {
      void platform.openReleasePage()
    }

    const handleInstall = () => {
      void install.run()
    }

    const handleLater = () => {
      dismiss()
    }

    const handlePrimary = isLinuxPackage ? handleDownload : handleInstall
    const actionLabel = isLinuxPackage ? 'Download' : 'Update'

    toast(`Version ${update.version} is available`, {
      id: `update-${update.version}`,
      duration: TOAST_DURATION_MS,
      action: { label: actionLabel, onClick: handlePrimary },
      cancel: { label: 'Later', onClick: handleLater },
    })
  }, [isVisible, update, installKind, install, dismiss])

  return null
}
