interface OwnEvent {
  currentTarget: Element
  target: EventTarget
}

/** True when the event started inside this element's DOM, not in a portal rendered from it. */
export function isOwnEvent(event: OwnEvent): boolean {
  return event.target instanceof Node && event.currentTarget.contains(event.target)
}
