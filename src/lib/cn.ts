import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class names, keeping the last conflicting utility. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
