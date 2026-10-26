import { toast } from 'sonner'

import { messageOf } from '@/core/errors'

/** Shows an error toast with the message of a caught value. */
export function toastError(error: unknown, fallback?: string): void {
  toast.error(messageOf(error, fallback))
}

/** Copies text, then toasts the success message or a fixed failure toast. */
export async function copyText(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.error('Copy failed')
  }
}
