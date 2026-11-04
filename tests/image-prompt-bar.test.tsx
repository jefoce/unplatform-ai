/* eslint-disable max-lines -- prompt bar cases stay in one suite */

// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PromptField } from '@/features/generator/prompt/PromptField'
import { ImageCountStepper } from '@/features/image-generator/ImageCountStepper'
import { ImagePromptBar } from '@/features/image-generator/ImagePromptBar'
import { useImageGeneratorStore } from '@/features/image-generator/store'

import { IMAGE_MAX_ACTIVE } from '../src/core/constants'
import { required } from './helpers/required'

vi.hoisted(() => {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
      },
    })
  }
})

const mocks = vi.hoisted(() => {
  return {
    submit: vi.fn(),
    estimate: { usd: 0.02, isApproximate: true, isLoading: false },
    estimateEnabled: false,
    provider: { isKeyMissing: false, isReady: true, reason: null as string | null },
  }
})

vi.mock('@/features/generator/use-provider-ready', () => {
  return {
    useProviderReady: () => {
      return mocks.provider
    },
  }
})

vi.mock('@/features/image-generator/ImageReferences', () => {
  return {
    ImageReferences: () => {
      return null
    },
  }
})

vi.mock('@/features/image-generator/use-image-estimate', () => {
  return {
    useImageEstimate: (isEnabled: boolean) => {
      mocks.estimateEnabled = isEnabled

      return mocks.estimate
    },
  }
})

vi.mock('@/features/image-generator/use-image-submit', () => {
  return {
    useImageSubmit: () => {
      return { submit: mocks.submit, isSubmitting: false }
    },
  }
})

vi.mock('@/features/generator/model/ModelPicker', () => {
  return {
    ModelPicker: () => {
      return null
    },
  }
})

class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface StepperHarnessProps {
  initial: number
}

function StepperHarness(props: StepperHarnessProps) {
  const [count, setCount] = useState(props.initial)

  return <ImageCountStepper count={count} onChange={setCount} />
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)

  Range.prototype.getBoundingClientRect = () => {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect
  }

  Range.prototype.getClientRects = () => {
    return {
      length: 0,
      item: () => {
        return null
      },
    } as unknown as DOMRectList
  }

  vi.stubGlobal('matchMedia', () => {
    return { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  })

  mocks.submit.mockReset()
  mocks.estimateEnabled = false
  mocks.provider = { isKeyMissing: false, isReady: true, reason: null }

  useImageGeneratorStore.setState({
    prompt: '',
    count: 1,
    references: [],
    uploadsById: {},
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ImageCountStepper', () => {
  it('steps up, down and stops at the bounds', () => {
    render(<StepperHarness initial={3} />)

    expect(required(screen.getByText('3').closest('div'), 'count stepper').className).toContain(
      'text-sm',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Increase image count' }))

    expect(screen.getByText('4')).toBeTruthy()

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Increase image count' }).disabled,
    ).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Decrease image count' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease image count' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease image count' }))

    expect(screen.getByText('1')).toBeTruthy()

    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Decrease image count' }).disabled,
    ).toBe(true)
  })
})

describe('ImagePromptBar provider lock', () => {
  it('disables Generate with the key reason from the shared provider check', async () => {
    mocks.provider = {
      isKeyMissing: true,
      isReady: false,
      reason: 'Add your OpenRouter key in Settings.',
    }

    act(() => {
      useImageGeneratorStore.setState({ prompt: 'a cat' })
    })

    render(<ImagePromptBar activeCount={0} />)

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    expect(button.disabled).toBe(true)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe(
      'Add your OpenRouter key in Settings.',
    )
  })
})

describe('ImagePromptBar active limit', () => {
  it('disables Generate before the server returns 429', async () => {
    act(() => {
      useImageGeneratorStore.setState({ prompt: 'a cat' })
    })

    render(<ImagePromptBar activeCount={IMAGE_MAX_ACTIVE} />)

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    expect(button.disabled).toBe(true)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe(
      `${IMAGE_MAX_ACTIVE} images already generating. Wait for one to finish.`,
    )
  })
})

describe('ImagePromptBar validation', () => {
  it('disables Generate with the first validation reason and enables it after typing', async () => {
    render(<ImagePromptBar activeCount={0} />)

    const button = screen.getByRole('button', { name: /Generate/ })

    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByLabelText('1 prompt warnings')).toBeNull()
    expect(within(button).getByText('~$0.02')).toBeTruthy()
    expect(mocks.estimateEnabled).toBe(true)

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe('Prompt is required')

    act(() => {
      useImageGeneratorStore.setState({ prompt: 'a cat' })
    })

    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ }).disabled).toBe(
        false,
      )
    })
  })
})

describe('image prompt warnings', () => {
  it('shows only warnings under the prompt, never blocking errors', async () => {
    render(<ImagePromptBar activeCount={0} />)

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Generate/ })

    expect(screen.queryByLabelText(/prompt warnings/)).toBeNull()

    fireEvent.focus(button)

    expect((await screen.findByRole('tooltip')).textContent).toBe('Prompt is required')
  })

  it('overlays the issue inside the prompt area without adding a layout row', () => {
    act(() => {
      useImageGeneratorStore.setState({ prompt: 'x'.repeat(5001) })
    })

    render(<ImagePromptBar activeCount={0} />)

    const chip = screen.getByLabelText('1 prompt warnings')
    const wrapper = required(chip.closest('[data-image-prompt-input]'), 'prompt wrapper')
    const controls = required(wrapper.parentElement, 'prompt controls')

    expect(chip.className).toContain('absolute')
    expect(chip.className).toContain('right-1')
    expect(chip.className).toContain('bottom-1')
    expect(chip.className).toContain('pointer-events-auto')
    expect(wrapper.className).toContain('relative')
    expect(wrapper.contains(screen.getByRole('textbox', { name: 'Prompt' }))).toBe(true)
    expect(controls.children).toHaveLength(2)
  })
})

describe('ImagePromptBar price', () => {
  it('skips the estimate when a setting is invalid', () => {
    act(() => {
      useImageGeneratorStore.setState({ count: 99 })
    })

    render(<ImagePromptBar activeCount={0} />)

    expect(mocks.estimateEnabled).toBe(false)
  })
})

describe('image prompt mentions', () => {
  it('pastes a copied video prompt as clean text', async () => {
    render(<ImagePromptBar activeCount={0} />)

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    fireEvent.click(editor)
    editor.focus()

    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        types: ['text/plain'],
        getData: () => {
          return '@[Image 1](image_1) a cat'
        },
      },
    })

    await waitFor(() => {
      expect(useImageGeneratorStore.getState().prompt).toBe('@Image 1 a cat')
    })
  })
})

describe('prompt submit key', () => {
  it('submits on Cmd+Enter and keeps plain Enter for a newline', async () => {
    const handleSubmit = vi.fn()

    render(
      <PromptField
        value=""
        onChange={vi.fn()}
        onSubmit={handleSubmit}
        isInline
        isReferences={false}
      />,
    )

    const editor = screen.getByRole('textbox', { name: 'Prompt' })

    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true })

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1)
    })

    fireEvent.keyDown(editor, { key: 'Enter' })

    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })
})
