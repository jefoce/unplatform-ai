/** Accent surface shared by the video and image Generate buttons. */
const GENERATE_ACTIVE_CLASSES =
  'bg-[radial-gradient(circle,var(--color-accent-hi)_40%,var(--color-accent))] text-on-accent shadow-[inset_0_-3px_rgba(0,0,0,0.43)] hover:opacity-80 active:scale-[0.97] active:opacity-60'

/** One disabled surface for both Generate buttons. */
export const GENERATE_DISABLED_CLASSES =
  'bg-disabled-surface text-disabled opacity-40 cursor-not-allowed'

export function generateSurfaceClass(isDisabled: boolean): string {
  if (isDisabled) {
    return GENERATE_DISABLED_CLASSES
  }

  return GENERATE_ACTIVE_CLASSES
}
