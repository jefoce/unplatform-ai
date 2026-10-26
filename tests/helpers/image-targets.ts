import { required } from './required'

/** Image targets in markdown image syntax and HTML src attributes. */
export function imageTargets(markdown: string): string[] {
  const targets: string[] = []

  for (const match of markdown.matchAll(/(?:!\[[^\]]*\]\(|\bsrc=")([^")\s]+)/g)) {
    const target = required(match[1], 'image target').split('#')[0] ?? ''

    if (target.includes('images/')) {
      targets.push(target)
    }
  }

  return targets
}
