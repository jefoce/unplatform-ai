import type { SWRInfiniteKeyedMutator } from 'swr/infinite'

export type FeedMutate<TPage> = SWRInfiniteKeyedMutator<TPage[]>

export interface FeedCache<TPage> {
  register: (mutate: FeedMutate<TPage>) => () => void
  read: () => Promise<TPage[][]>
  refresh: () => Promise<unknown>
  patch: (update: (pages: TPage[]) => TPage[]) => Promise<unknown>
}

/** Registry of mounted infinite feeds so global callers can read and patch them. */
export function createFeedCache<TPage>(): FeedCache<TPage> {
  const mutates = new Set<FeedMutate<TPage>>()

  const register = (mutate: FeedMutate<TPage>): (() => void) => {
    mutates.add(mutate)

    return () => {
      mutates.delete(mutate)
    }
  }

  const read = async (): Promise<TPage[][]> => {
    const pages = await Promise.all(
      [...mutates].map((mutate) => {
        return mutate(
          (current) => {
            return current ?? []
          },
          { revalidate: false },
        )
      }),
    )

    return pages.map((current) => {
      return current ?? []
    })
  }

  const refresh = (): Promise<unknown> => {
    return Promise.all(
      [...mutates].map((mutate) => {
        return mutate()
      }),
    )
  }

  const patch = (update: (pages: TPage[]) => TPage[]): Promise<unknown> => {
    return Promise.all(
      [...mutates].map((mutate) => {
        return mutate(
          (pages) => {
            return update(pages ?? [])
          },
          { revalidate: false },
        )
      }),
    )
  }

  return { register, read, refresh, patch }
}
