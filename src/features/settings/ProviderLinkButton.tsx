'use client'

import type { ProviderLink } from '@/core/providers/types'
import { toastError } from '@/lib/notify'
import { platform } from '@/lib/platform'

const LINK_CLASSES = 'text-xxs text-fg-2 hover:text-fg hover:underline'

interface ProviderLinkButtonProps {
  link: ProviderLink
}

/** Opens one provider link in the browser, or toasts why it failed. */
export function ProviderLinkButton(props: ProviderLinkButtonProps) {
  const { link } = props

  const handleOpen = () => {
    void platform.openExternal(link.url).catch((error: unknown) => {
      toastError(error, 'Could not open the link')
    })
  }

  return (
    <button type="button" className={LINK_CLASSES} onClick={handleOpen}>
      {link.label}
    </button>
  )
}
