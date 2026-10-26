'use client'

import { Button } from '@/ui/Button'

import type { ActionKey } from './preview-store'

interface PreviewActionButtonProps {
  actionKey: ActionKey
  label: string
  variant?: 'primary' | 'danger'
  onRun: (key: ActionKey) => void
}

/** Footer action bound to its key. */
export function PreviewActionButton(props: PreviewActionButtonProps) {
  const { actionKey, label, variant } = props

  const handleClick = () => {
    props.onRun(actionKey)
  }

  return (
    <Button size="sm" variant={variant} onClick={handleClick}>
      {label}
    </Button>
  )
}
