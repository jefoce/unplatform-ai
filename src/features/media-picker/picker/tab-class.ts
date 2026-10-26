import { cn } from '@/lib/cn'

/** Shared pill classes for picker tabs. */
export function tabClass(isActive: boolean): string {
  return cn(
    'flex h-9 shrink-0 items-center rounded-lg px-4 text-xs font-medium transition',
    isActive && 'bg-fg text-page',
    !isActive && 'text-fg hover:bg-white/5',
  )
}
