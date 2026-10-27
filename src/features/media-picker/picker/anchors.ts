const anchors = new Map<string, HTMLElement>()

/** Registers the region a picker opener anchors to, returns its cleanup. */
export function registerPickerAnchor(key: string, element: HTMLElement): () => void {
  anchors.set(key, element)

  return () => {
    if (anchors.get(key) === element) {
      anchors.delete(key)
    }
  }
}

/** Element registered for the key, null when its region is not mounted. */
export function pickerAnchor(key: string): HTMLElement | null {
  return anchors.get(key) ?? null
}
