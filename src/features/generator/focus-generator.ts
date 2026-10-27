/** Scrolls the generator panel into view, or to the top when it is not mounted. */
export function focusGenerator(): void {
  const panel = document.getElementById('generator-panel')

  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })

    return
  }

  window.scrollTo({ top: 0, behavior: 'smooth' })
}
