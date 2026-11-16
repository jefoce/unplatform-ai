// @vitest-environment jsdom
import fs from 'node:fs'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderReleaseNotes } from '@/lib/release-notes'

function renderNotes(markdown: string, onOpen = vi.fn()) {
  const view = render(<div>{renderReleaseNotes(markdown, onOpen)}</div>)

  return { ...view, onOpen }
}

afterEach(() => {
  cleanup()
})

describe('renderReleaseNotes headings', () => {
  it('renders ## as a level 3 heading without the markers', () => {
    const { container } = renderNotes('## Added')
    const heading = container.querySelector('h3')

    expect(heading?.textContent).toBe('Added')
    expect(container.textContent).not.toContain('##')
  })

  it('renders ### as a level 4 heading', () => {
    const { container } = renderNotes('### Fixed')

    expect(container.querySelector('h4')?.textContent).toBe('Fixed')
  })
})

describe('renderReleaseNotes lists', () => {
  it('renders - and * lines as list items', () => {
    const { container } = renderNotes('- one\n* two')
    const items = container.querySelectorAll('li')

    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toBe('one')
    expect(items[1]?.textContent).toBe('two')
  })
})

describe('renderReleaseNotes inline', () => {
  it('renders bold, italic and code', () => {
    const { container } = renderNotes('**bold** and *italic* and `code`')

    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelector('em')?.textContent).toBe('italic')
    expect(container.querySelector('code')?.textContent).toBe('code')
  })

  it('opens an allowed link through the caller', () => {
    const url = 'https://github.com/jefoce/unplatform-ai/blob/HEAD/LICENSE'
    const { onOpen } = renderNotes(`[LICENSE](${url})`)

    fireEvent.click(screen.getByRole('link', { name: 'LICENSE' }))

    expect(onOpen).toHaveBeenCalledWith(url)
  })

  it('keeps a disallowed link as plain label text', () => {
    const { container } = renderNotes('[click](https://evil.example)')

    expect(screen.queryByRole('link')).toBeNull()
    expect(container.textContent).toContain('click')
  })

  it('keeps raw HTML as text', () => {
    const { container } = renderNotes('<script>alert(1)</script>')

    expect(container.textContent).toContain('<script>alert(1)</script>')
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('renderReleaseNotes on the 0.5.0 changelog section', () => {
  it('renders the section without Markdown markers', () => {
    const changelog = fs.readFileSync('CHANGELOG.md', 'utf8')
    const start = changelog.indexOf('## 0.5.0')

    expect(start).toBeGreaterThan(-1)

    const { container } = renderNotes(changelog.slice(start))

    expect(container.textContent).not.toContain('##')
    expect(container.textContent).not.toContain('**')
    expect(container.textContent).toContain('ComfyUI')
  })
})
