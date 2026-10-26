'use client'

import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

import { checkForUpdate } from './check-update'
import { useUpdateStore } from './update-store'
import { useInstallUpdate } from './use-install-update'

function checkNow(): void {
  void checkForUpdate(true)
}

function openReleasePage(): void {
  void platform.openReleasePage().catch((error: unknown) => {
    toastError(error, 'Could not open the release page')
  })
}

/** Update actions for the App section, one install action shared with the toast. */
export function useAppUpdateActions() {
  const install = useInstallUpdate()

  const setAutoCheckValue = useUpdateStore((state) => {
    return state.setAutoCheckValue
  })

  const installNow = () => {
    void install.run()
  }

  const setAutoCheck = (isOn: boolean) => {
    setAutoCheckValue(isOn)

    void platform.setAutoCheck(isOn).catch((error: unknown) => {
      setAutoCheckValue(!isOn)
      toastError(error, 'Could not save the update setting')
    })
  }

  return {
    isInstalling: install.isRunning,
    check: checkNow,
    installNow,
    openRelease: openReleasePage,
    setAutoCheck,
  }
}
