import { currentWorkspaceTab } from '@/features/shared/use-workspace-tab'

/** Focuses the image prompt, else scrolls the generator panel into view. */
export function focusGenerator(): void {
  if (currentWorkspaceTab() === 'image') {
    const editor = document.querySelector<HTMLElement>(
      '[data-image-prompt-input] [contenteditable="true"]',
    )

    if (editor) {
      editor.focus()

      return
    }
  }

  const panel = document.getElementById('generator-panel')

  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })

    return
  }

  window.scrollTo({ top: 0, behavior: 'smooth' })
}
