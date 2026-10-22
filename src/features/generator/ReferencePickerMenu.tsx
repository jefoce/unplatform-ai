'use client'

import type { BeautifulMentionsMenuProps } from 'lexical-beautiful-mentions'

import { cn } from '@/lib/cn'

/** Typeahead shell for reference mentions. */
export function ReferencePickerMenu(props: BeautifulMentionsMenuProps) {
  const { className, loading: isLoading, ...rest } = props

  return (
    <ul
      {...rest}
      aria-busy={isLoading === true ? true : undefined}
      className={cn(
        'z-50 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-2xl',
        className,
      )}
    />
  )
}
