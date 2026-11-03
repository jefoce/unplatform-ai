'use client'

import { tabClass } from './tab-class'

interface PickerStaticTabProps {
  value: string
  label: string
  isActive: boolean
  onTabChange: (tab: string) => void
}

/** One static uploads, generations or liked tab. */
export function PickerStaticTab(props: PickerStaticTabProps) {
  const { value, label, isActive } = props

  const handleClick = (): void => {
    props.onTabChange(value)
  }

  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={handleClick}
      className={tabClass(isActive)}
    >
      {label}
    </button>
  )
}
