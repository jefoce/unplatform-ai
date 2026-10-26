import { seconds } from '@/core/validation-media'

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** "October 20, 2026, 01:44" */
export function formatDate(iso: string): string {
  return DATE_FORMAT.formatToParts(new Date(iso))
    .map((part) => {
      if (part.type === 'literal' && part.value.trim() === 'at') {
        return ', '
      }

      return part.value
    })
    .join('')
}

/** Integer seconds stay short, e.g. "5s" or "5.5s". */
export function formatSecondsShort(seconds: number): string {
  if (Number.isInteger(seconds)) {
    return `${seconds}s`
  }

  return `${Number(seconds.toFixed(1))}s`
}

/** Up to two decimals, trailing zeros dropped, e.g. "15.02s" or "15s". */
export function formatSecondsExact(value: number): string {
  return `${seconds(value)}s`
}

/** m:ss for >= 60s, otherwise `6.8s` unless `shouldAlwaysClock` is set. */
export function formatMediaDuration(seconds: number, shouldAlwaysClock = false): string {
  if (!shouldAlwaysClock && seconds < 60) {
    return formatSecondsShort(seconds)
  }

  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)

  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** Clock form m:ss, clamped at zero. */
export function formatClock(seconds: number): string {
  const whole = Math.floor(Math.max(0, seconds))

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** Binary byte size with one decimal above KB, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes)
  let unit = 0

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  let rounded: number

  if (unit === 0) {
    rounded = Math.round(value)
  } else {
    rounded = Math.round(value * 10) / 10
  }

  return `${rounded} ${BYTE_UNITS[unit]}`
}

/** Short relative age, e.g. "just now", "5 min ago", "2 h ago", "3 d ago". */
export function formatAgo(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))

  if (seconds < 60) {
    return 'just now'
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ago`
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} h ago`
  }

  return `${Math.floor(seconds / 86400)} d ago`
}

/** Cuts text to `max` characters including a trailing "...". */
export function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }

  return `${text.slice(0, Math.max(0, max - 3))}...`
}
