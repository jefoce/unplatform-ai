'use client'

import { isNil } from 'lodash-es'
import type { ZodType } from 'zod'
import { create, type StateCreator, type StoreApi, type UseBoundStore } from 'zustand'
import { persist } from 'zustand/middleware'

interface DraftStoreConfig<TState extends object, TPersisted extends object> {
  name: string
  version: number
  schema: ZodType<TPersisted>
  create: StateCreator<TState, [['zustand/persist', unknown]], []>
  partialize: (state: TState) => TPersisted

  /** Reapplies the preset rules after a stored draft is loaded. */
  normalize?: (state: TState) => Partial<TState>
}

/** Draft store that validates its stored fields and rehydrates through one merge. */
export function createDraftStore<TState extends object, TPersisted extends object>(
  config: DraftStoreConfig<TState, TPersisted>,
): UseBoundStore<StoreApi<TState>> {
  const { name, version, schema, partialize, normalize } = config

  function rehydrate(state: TState | undefined): void {
    if (isNil(state) || isNil(normalize)) {
      return
    }

    queueMicrotask(() => {
      store.setState(normalize(store.getState()))
    })
  }

  const store = create<TState>()(
    persist(config.create, {
      name,
      version,
      partialize,
      merge: (persisted, current) => {
        const parsed = schema.safeParse(persisted)

        if (!parsed.success) {
          return current
        }

        return { ...current, ...parsed.data }
      },
      onRehydrateStorage: () => {
        return rehydrate
      },
    }),
  )

  return store
}
