import { beforeEach, describe, expect, it } from 'vitest'

import { useSelectionStore } from '@/features/history/selection/selection-store'

const state = () => {
  return useSelectionStore.getState()
}

const ORDER = ['a', 'b', 'c', 'd', 'e']

beforeEach(() => {
  state().clear()
  state().setOrder(ORDER)
})

describe('selection store', () => {
  it('toggles ids and moves the anchor', () => {
    state().toggle('a')
    expect([...state().ids]).toEqual(['a'])
    expect(state().anchorId).toBe('a')

    state().toggle('b')
    expect([...state().ids]).toEqual(['a', 'b'])
    expect(state().anchorId).toBe('b')

    state().toggle('a')
    expect([...state().ids]).toEqual(['b'])
    expect(state().anchorId).toBe('a')
  })

  it('selects a forward range from the anchor', () => {
    state().toggle('b')
    state().selectRange('d')
    expect([...state().ids].sort()).toEqual(['b', 'c', 'd'])
    expect(state().anchorId).toBe('b')
  })

  it('selects a backward range from the anchor', () => {
    state().toggle('d')
    state().selectRange('a')
    expect([...state().ids].sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(state().anchorId).toBe('d')
  })

  it('acts like a toggle when there is no anchor', () => {
    state().selectRange('c')
    expect([...state().ids]).toEqual(['c'])
    expect(state().anchorId).toBe('c')
  })

  it('adds a range and never removes existing ids', () => {
    state().setMany(['a', 'e'], true)
    state().toggle('c')
    state().selectRange('d')
    expect([...state().ids].sort()).toEqual(['a', 'c', 'd', 'e'])
  })

  it('keeps the visible order for ranges', () => {
    state().setOrder(['c', 'b', 'a'])
    state().toggle('a')
    state().selectRange('c')
    expect([...state().ids].sort()).toEqual(['a', 'b', 'c'])
  })

  it('sets many ids on and off', () => {
    state().setMany(['a', 'b'], true)
    state().setMany(['b', 'c'], false)
    expect([...state().ids]).toEqual(['a'])
  })

  it('prunes missing ids and a missing anchor', () => {
    state().setMany(['a', 'b', 'c'], true)
    state().toggle('c')
    state().prune(new Set(['a', 'b']))
    expect([...state().ids].sort()).toEqual(['a', 'b'])
    expect(state().anchorId).toBeNull()
  })

  it('clears ids and the anchor', () => {
    state().setMany(['a', 'b'], true)
    state().clear()
    expect(state().ids.size).toBe(0)
    expect(state().anchorId).toBeNull()
  })
})
