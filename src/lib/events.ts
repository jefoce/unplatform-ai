/** True when the event started inside this element's DOM, not in a portal rendered from it. */
export function isOwnEvent(event: { currentTarget: Element; target: EventTarget }): boolean {
  return event.target instanceof Node && event.currentTarget.contains(event.target)
}
