// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { focusGenerator } from '@/features/generator/focus-generator'

function appendPrompt(): HTMLElement {
  const wrapper = document.createElement('div')

  wrapper.setAttribute('data-image-prompt-input', '')

  const editor = document.createElement('div')

  editor.setAttribute('contenteditable', 'true')
  editor.tabIndex = 0
  wrapper.append(editor)
  document.body.append(wrapper)

  return editor
}

afterEach(() => {
  document.body.replaceChildren()
  window.history.replaceState(null, '', '/')
})

describe('focusGenerator', () => {
  it('focuses the image prompt editor on the image tab', () => {
    window.history.replaceState(null, '', '/?tab=image')

    const editor = appendPrompt()

    focusGenerator()

    expect(document.activeElement).toBe(editor)
  })

  it('scrolls the video panel and leaves the prompt alone on the video tab', () => {
    const editor = appendPrompt()
    const panel = document.createElement('div')
    const scrollIntoView = vi.fn()

    panel.id = 'generator-panel'
    panel.scrollIntoView = scrollIntoView
    document.body.append(panel)

    focusGenerator()

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(document.activeElement).not.toBe(editor)
  })
})
