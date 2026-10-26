/** Joins items as "a, b, and c" or "a, b, or c", matching the old local helpers. */
export function joinWords(items: readonly string[], conjunction: 'and' | 'or'): string {
  const [first] = items

  if (items.length < 2) {
    return first ?? ''
  }

  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`
}
