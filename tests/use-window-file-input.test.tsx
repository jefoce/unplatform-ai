// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeneratorStore } from '@/features/generator/store/store'
import {
  useWindowFileInput,
  type UseWindowFileInputParams,
} from '@/features/media-input/use-window-file-input'
import {
  closeMediaPicker,
  openMediaPicker,
  type PickerToggleMode,
} from '@/features/media-picker/picker/store'
import { getPlatform } from '@/lib/platform'

import { emitFileDrop, mockPlatform } from './helpers/platform-mock'

vi.mock('@/lib/platform', () => {
  return { getPlatform: vi.fn() }
})

const png = new File(['png'], 'a.png', { type: 'image/png' })
const gif = new File(['gif'], 'b.gif', { type: 'image/gif' })

interface DragDataParams {
  files?: File[]
  types?: string[]
}

function dragData(params: DragDataParams = {}) {
  const files = params.files ?? []

  return {
    files,
    types: params.types ?? ['Files'],
  }
}

function pasteData(files: File[] = [], text = '') {
  return {
    files,
    getData: () => {
      return text
    },
  }
}

function Harness(props: UseWindowFileInputParams) {
  const { isDragging, hint } = useWindowFileInput(props)

  return (
    <>
      <span data-testid="state">{isDragging ? 'dragging' : 'idle'}</span>
      <span data-testid="hint">{hint}</span>
    </>
  )
}

function renderHarness(
  onFiles: UseWindowFileInputParams['onFiles'],
  onPaths: UseWindowFileInputParams['onPaths'] = vi.fn(),
): void {
  render(<Harness onFiles={onFiles} onPaths={onPaths} />)
}

async function flushDropSetup(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function state(): string | null {
  return screen.getByTestId('state').textContent
}

function hint(): string | null {
  return screen.getByTestId('hint').textContent
}

function pickRequest() {
  return {
    openerKey: 'test',
    kinds: ['image' as const],
    mode: { kind: 'pick' as const, onPick: vi.fn() },
  }
}

function toggleMode(): PickerToggleMode {
  return {
    kind: 'toggle',
    useSelectedIds: () => {
      return []
    },
    useUploadsById: () => {
      return {}
    },
    canAdd: () => {
      return null
    },
    onToggle: vi.fn(),
    onAdd: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPlatform).mockResolvedValue(mockPlatform)
  useGeneratorStore.setState({ tab: 'references' })
})

afterEach(() => {
  cleanup()
  closeMediaPicker()
})

describe('useWindowFileInput drag', () => {
  it('keeps dragging until the last nested leave', () => {
    renderHarness(vi.fn())

    fireEvent.dragEnter(window, { dataTransfer: dragData() })
    fireEvent.dragEnter(window, { dataTransfer: dragData() })

    expect(state()).toBe('dragging')

    fireEvent.dragLeave(window)

    expect(state()).toBe('dragging')

    fireEvent.dragLeave(window)

    expect(state()).toBe('idle')
  })

  it('ignores a drag without files', () => {
    renderHarness(vi.fn())

    fireEvent.dragEnter(window, { dataTransfer: dragData({ types: ['text/plain'] }) })

    expect(state()).toBe('idle')
  })

  it('calls the handler with dropped files', () => {
    const onFiles = vi.fn()

    renderHarness(onFiles)

    fireEvent.dragEnter(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.drop(window, { dataTransfer: dragData({ files: [png] }) })

    expect(onFiles).toHaveBeenCalledWith([png])
    expect(state()).toBe('idle')
  })
})

describe('useWindowFileInput desktop platform', () => {
  it('marks dragging from an over event and clears on leave', async () => {
    renderHarness(vi.fn())
    await flushDropSetup()

    await act(async () => {
      emitFileDrop({ type: 'over', x: 10, y: 20 })
    })

    expect(state()).toBe('dragging')

    await act(async () => {
      emitFileDrop({ type: 'leave' })
    })

    expect(state()).toBe('idle')
  })

  it('calls the paths handler with dropped paths', async () => {
    const onFiles = vi.fn()
    const onPaths = vi.fn()

    renderHarness(onFiles, onPaths)
    await flushDropSetup()

    await act(async () => {
      emitFileDrop({ type: 'drop', x: 0, y: 0, paths: ['/tmp/a.png'] })
    })

    expect(onPaths).toHaveBeenCalledWith(['/tmp/a.png'])
    expect(onFiles).not.toHaveBeenCalled()
    expect(state()).toBe('idle')
  })
})

describe('useWindowFileInput paste', () => {
  it('calls the handler with pasted files', () => {
    const onFiles = vi.fn()

    renderHarness(onFiles)

    fireEvent.paste(window, { clipboardData: pasteData([png, gif]) })

    expect(onFiles).toHaveBeenCalledWith([png, gif])
  })

  it('lets text through in an editable field', () => {
    const onFiles = vi.fn()

    render(
      <>
        <Harness onFiles={onFiles} onPaths={vi.fn()} />
        <textarea aria-label="prompt" />
      </>,
    )

    fireEvent.paste(screen.getByLabelText('prompt'), {
      clipboardData: pasteData([png], 'hello'),
    })

    expect(onFiles).not.toHaveBeenCalled()
  })

  it('ignores a text-only paste', () => {
    const onFiles = vi.fn()

    renderHarness(onFiles)

    fireEvent.paste(window, { clipboardData: pasteData([], 'hello') })

    expect(onFiles).not.toHaveBeenCalled()
  })
})

describe('useWindowFileInput picker', () => {
  it('handles drag and paste while a picker request is open', () => {
    const onFiles = vi.fn()

    act(() => {
      openMediaPicker(pickRequest())
    })

    renderHarness(onFiles)

    fireEvent.dragEnter(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.drop(window, { dataTransfer: dragData({ files: [png] }) })
    fireEvent.paste(window, { clipboardData: pasteData([png]) })

    expect(state()).toBe('idle')
    expect(onFiles).toHaveBeenCalledTimes(2)
    expect(onFiles).toHaveBeenNthCalledWith(1, [png])
    expect(onFiles).toHaveBeenNthCalledWith(2, [png])
  })
})

describe('useWindowFileInput hint', () => {
  it('follows the generator tab while the picker is closed', () => {
    renderHarness(vi.fn())

    expect(hint()).toBe('as references')

    act(() => {
      useGeneratorStore.setState({ tab: 'frames' })
    })

    expect(hint()).toBe('as start frame')
  })

  it('follows the open picker mode', () => {
    renderHarness(vi.fn())

    act(() => {
      openMediaPicker({ openerKey: 'test', kinds: ['image'], mode: toggleMode() })
    })

    expect(hint()).toBe('as references')

    act(() => {
      closeMediaPicker()
      openMediaPicker(pickRequest())
    })

    expect(hint()).toBe('as start frame')
  })
})
