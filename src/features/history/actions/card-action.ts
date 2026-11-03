import type { LucideIcon } from 'lucide-react'

export interface CardActionConfirm {
  label: string
  title: string
  description: string
  confirmLabel?: string
  isDanger?: boolean
  successMessage?: string | null
  onConfirm: () => Promise<void>
}

interface CardActionBase {
  key: string
  label: string
  icon: LucideIcon
  isActive?: boolean
  isPinned?: boolean
}

interface CardActionRun extends CardActionBase {
  onSelect: () => void
}

/** Confirmation before running `onConfirm`. */
interface CardActionConfirmAction extends CardActionBase {
  confirm: CardActionConfirm
  onSelect?: undefined
}

export type CardAction = CardActionRun | CardActionConfirmAction
