import { isNil } from 'lodash-es'

import type { MediaKind } from './types'

export const MEDIA_KINDS = ['image', 'video', 'audio'] as const satisfies readonly MediaKind[]

export const KIND_TITLE: Record<MediaKind, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
}
export const KIND_PLURAL: Record<MediaKind, string> = {
  image: 'images',
  video: 'videos',
  audio: 'audio',
}

export const kindFromTitle = (title: string): MediaKind | null =>
  MEDIA_KINDS.find((kind) => KIND_TITLE[kind] === title) ?? null

export type KindExtensions = Partial<Record<MediaKind, readonly string[]>>

const EXTENSIONS: Record<MediaKind, readonly string[]> = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
  audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg'],
}

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
}

const normalizeExt = (ext: string): string => ext.trim().toLowerCase().replace(/^\./, '')

export function kindFromExt(ext: string): MediaKind | null {
  const normalized = normalizeExt(ext)

  return MEDIA_KINDS.find((kind) => EXTENSIONS[kind].includes(normalized)) ?? null
}

export function kindFromName(name: string): MediaKind | null {
  const dot = name.lastIndexOf('.')

  return dot < 0 ? null : kindFromExt(name.slice(dot + 1))
}

const ABSOLUTE_PATH = /^(?:\/|[A-Za-z]:[\\/])/

interface PastedPathParams {
  text: string
  kinds: readonly MediaKind[]
  extensions?: KindExtensions
}

/** Absolute media path pasted as text, filtered to the requested kinds and formats. */
export function pastedPath(params: PastedPathParams): string | null {
  const { text, kinds, extensions } = params
  const path = text
    .trim()
    .replaceAll(/^["']+|["']+$/g, '')
    .trim()

  if (!ABSOLUTE_PATH.test(path)) return null

  const kind = kindFromName(path)

  if (isNil(kind) || !kinds.includes(kind)) return null

  return extensionAllowed({ kind, ext: extWithDot(path), extensions }) ? path : null
}

interface ExtensionAllowedParams {
  kind: MediaKind
  ext: string
  extensions?: KindExtensions
}

interface FileInfo {
  name: string
  type: string
}

/** Kind from the file name, then from the MIME type. */
export function kindFromFile(file: FileInfo): MediaKind | null {
  const byName = kindFromName(file.name)

  if (!isNil(byName)) return byName

  const ext = Object.entries(MIME_TYPES).find(([, mime]) => mime === file.type)?.[0]

  return isNil(ext) || ext === '' ? null : kindFromExt(ext)
}

/** True when the kind has no filter or the extension is listed. */
export function extensionAllowed(params: ExtensionAllowedParams): boolean {
  const { kind, ext, extensions } = params
  const allowed = extensions?.[kind]

  return isNil(allowed) || allowed.length === 0 || allowed.includes(normalizeExt(ext))
}

/** Splits files into accepted ones and a skip count for a toast. */
interface AcceptFilesParams<T> {
  files: T[]
  kinds: readonly MediaKind[]
  extensions?: KindExtensions
}

export function acceptFiles<T extends FileInfo>(
  params: AcceptFilesParams<T>,
): { accepted: T[]; skipped: number } {
  const { files, kinds, extensions } = params
  const accepted = files.filter((file) => {
    const kind = kindFromFile(file)

    if (isNil(kind) || !kinds.includes(kind)) return false

    return extensionAllowed({ kind, ext: extensionOf(file), extensions })
  })

  return { accepted, skipped: files.length - accepted.length }
}

export function mimeFromExt(ext: string): string | null {
  return MIME_TYPES[normalizeExt(ext)] ?? null
}

export function acceptForKinds(kinds: readonly MediaKind[], extensions?: KindExtensions): string {
  return extensionsForKinds(kinds, extensions)
    .map((ext) => `.${ext}`)
    .join(',')
}

/** Dialog extensions for the kinds, without dots. */
export function extensionsForKinds(
  kinds: readonly MediaKind[],
  extensions?: KindExtensions,
): string[] {
  return kinds.flatMap((kind) => {
    const custom = extensions?.[kind]
    const list = !isNil(custom) && custom.length > 0 ? custom : EXTENSIONS[kind]

    return list.map(normalizeExt)
  })
}

/** Name extension, else one derived from the MIME type. */
function extensionOf(file: FileInfo): string {
  const dot = file.name.lastIndexOf('.')

  if (dot >= 0) return file.name.slice(dot + 1)

  return Object.entries(MIME_TYPES).find(([, mime]) => mime === file.type)?.[0] ?? ''
}

export function extWithDot(name: string): string {
  const dot = name.lastIndexOf('.')

  return dot < 0 ? '' : name.slice(dot).toLowerCase()
}
