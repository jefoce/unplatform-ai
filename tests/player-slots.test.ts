import { beforeEach, describe, expect, it, vi } from 'vitest'

import { acquire, getSnapshot, isActive, release, subscribe } from '@/features/player/player-slots'

beforeEach(() => {
  for (const id of getSnapshot()) release(id)
})

describe('player slots', () => {
  it('acquiring a third evicts the first, newest last', () => {
    acquire('a')
    acquire('b')
    acquire('c')

    expect(getSnapshot()).toEqual(['b', 'c'])
    expect(isActive('a')).toBe(false)
  })

  it('re-acquiring an existing id moves it to the end without exceeding 2', () => {
    acquire('a')
    acquire('b')
    acquire('a')

    expect(getSnapshot()).toEqual(['b', 'a'])
  })

  it('release removes only that id and emits once', () => {
    acquire('a')
    acquire('b')
    const fn = vi.fn()

    subscribe(fn)

    release('a')
    expect(getSnapshot()).toEqual(['b'])
    expect(fn).toHaveBeenCalledTimes(1)

    release('missing')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('stops notifications after unsubscribe', () => {
    const fn = vi.fn()
    const unsubscribe = subscribe(fn)

    acquire('a')
    expect(fn).toHaveBeenCalledTimes(1)

    unsubscribe()
    release('a')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('returns a new snapshot on mutation, same one on no-op release', () => {
    const before = getSnapshot()

    acquire('a')

    const after = getSnapshot()

    expect(after).not.toBe(before)

    release('missing')
    expect(getSnapshot()).toBe(after)
  })
})
