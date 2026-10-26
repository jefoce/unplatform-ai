/** String-keyed map. */
export type Dict<T> = Record<string, T>

/** Anything stored by id. */
export interface HasId {
  id: string
}
