// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ReferencePickerMenuItem } from '@/features/generator/references/ReferencePickerMenuItem'

import { required } from './helpers/required'

afterEach(() => {
  cleanup()
})

const LABELS = ['Image 1', 'Image 2']

function menuItem(label: string) {
  return { trigger: '@', value: label, displayValue: label }
}

describe('ReferencePickerMenuItem', () => {
  it('highlights the pointer item before its own click selects it', () => {
    const picks: string[] = []

    function Picker() {
      const [highlighted, setHighlighted] = useState(0)

      return (
        <ul>
          {LABELS.map((label, index) => {
            return (
              <ReferencePickerMenuItem
                key={label}
                selected={highlighted === index}
                label={label}
                itemValue={label}
                item={menuItem(label)}
                onClick={() => {
                  setHighlighted(index)
                  picks.push(label)
                }}
                onMouseEnter={() => {
                  setHighlighted(index)
                }}
              />
            )
          })}
        </ul>
      )
    }

    const { container } = render(<Picker />)
    const rows = container.querySelectorAll<HTMLLIElement>('li')
    const first = required(rows[0], 'first item')
    const second = required(rows[1], 'second item')

    fireEvent.mouseDown(second)

    expect(first.getAttribute('data-selected')).toBeNull()
    expect(second.getAttribute('data-selected')).toBe('true')

    fireEvent.click(second)

    expect(picks).toEqual(['Image 2'])
  })
})
