import { isNil } from 'lodash-es'
import type { ReactNode } from 'react'

import { ReleaseNoteLink } from './release-note-link'

const LINK_PREFIX = 'https://github.com/jefoce/unplatform-ai'
const HEADING_THREE = /^###\s+(.*)$/
const HEADING_TWO = /^##\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g

type OpenLink = (url: string) => void

interface ParagraphBlock {
  kind: 'paragraph'
  text: string
}

interface HeadingBlock {
  kind: 'heading'
  level: 2 | 3
  text: string
}

interface BulletBlock {
  kind: 'bullets'
  items: string[]
}

type Block = ParagraphBlock | HeadingBlock | BulletBlock

function blocksOf(markdown: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let bullets: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
      paragraph = []
    }
  }

  const flushBullets = (): void => {
    if (bullets.length > 0) {
      blocks.push({ kind: 'bullets', items: bullets })
      bullets = []
    }
  }

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()

    if (line === '') {
      flushParagraph()
      flushBullets()
      continue
    }

    const three = HEADING_THREE.exec(line)

    if (!isNil(three)) {
      flushParagraph()
      flushBullets()
      blocks.push({ kind: 'heading', level: 3, text: three[1] ?? '' })
      continue
    }

    const two = HEADING_TWO.exec(line)

    if (!isNil(two)) {
      flushParagraph()
      flushBullets()
      blocks.push({ kind: 'heading', level: 2, text: two[1] ?? '' })
      continue
    }

    const bullet = BULLET.exec(line)

    if (!isNil(bullet)) {
      flushParagraph()
      bullets.push(bullet[1] ?? '')
      continue
    }

    flushBullets()
    paragraph.push(line)
  }

  flushParagraph()
  flushBullets()

  return blocks
}

interface MatchNodeParams {
  match: RegExpMatchArray
  key: string
  onOpen: OpenLink
}

function matchNode(params: MatchNodeParams): ReactNode {
  const { match, key, onOpen } = params
  const bold = match[1]
  const italic = match[2]
  const code = match[3]
  const label = match[4]
  const url = match[5]

  if (!isNil(bold)) {
    return <strong key={key}>{bold}</strong>
  }

  if (!isNil(italic)) {
    return <em key={key}>{italic}</em>
  }

  if (!isNil(code)) {
    return (
      <code key={key} className="font-mono text-fg">
        {code}
      </code>
    )
  }

  if (!isNil(label) && !isNil(url) && url.startsWith(LINK_PREFIX)) {
    return <ReleaseNoteLink key={key} label={label} onOpen={onOpen} url={url} />
  }

  return label ?? match[0]
}

function inlineNodes(text: string, onOpen: OpenLink): ReactNode[] {
  const nodes: ReactNode[] = []
  let index = 0

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0

    if (start > index) {
      nodes.push(text.slice(index, start))
    }

    nodes.push(matchNode({ match, key: `inline-${start}`, onOpen }))

    index = start + match[0].length
  }

  if (index < text.length) {
    nodes.push(text.slice(index))
  }

  return nodes
}

/** Renders the safe subset used by release notes. Everything else stays plain text. */
export function renderReleaseNotes(markdown: string, onOpen: OpenLink): ReactNode {
  return blocksOf(markdown).map((block, index) => {
    const key = `block-${index}`

    if (block.kind === 'bullets') {
      return (
        <ul key={key} className="list-disc space-y-1 pl-4">
          {block.items.map((item, itemIndex) => {
            // eslint-disable-next-line react/no-array-index-key -- static notes list
            return <li key={`${key}-${itemIndex}`}>{inlineNodes(item, onOpen)}</li>
          })}
        </ul>
      )
    }

    if (block.kind === 'heading') {
      const Heading = block.level === 2 ? 'h3' : 'h4'

      const className =
        block.level === 2 ? 'text-xs font-medium text-fg' : 'text-xxs font-medium text-fg'

      return (
        <Heading key={key} className={className}>
          {inlineNodes(block.text, onOpen)}
        </Heading>
      )
    }

    return <p key={key}>{inlineNodes(block.text, onOpen)}</p>
  })
}
