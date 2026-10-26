import { isNil } from 'lodash-es'
import { toast } from 'sonner'

import { acceptFiles, type KindExtensions } from '@/core/media-kinds'
import type { MediaKind } from '@/core/media-types'
import type { UploadItem } from '@/core/schemas/upload-item'

import { getPlatform } from './index'
import { linkPaths } from './link-paths'

export interface DropZone {
  kinds: () => readonly MediaKind[]
  extensions?: () => KindExtensions | undefined
  onHover: (over: boolean) => void
  onUploaded: (items: UploadItem[]) => void
}

const zones = new Map<string, DropZone>()
let hovered: string | null = null
let hasStarted = false

/** Zones mark their element with data-drop-zone="<id>". */
export function registerDropZone(id: string, zone: DropZone): () => void {
  zones.set(id, zone)
  void start()

  return () => {
    zones.delete(id)

    if (hovered === id) {
      hovered = null
    }
  }
}

/** Innermost zone under the point. */
function zoneAt(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-zone]')
  const id = element?.dataset.dropZone ?? null

  if (!isNil(id) && zones.has(id)) {
    return id
  }

  return null
}

function setHovered(id: string | null): void {
  if (hovered === id) {
    return
  }

  if (!isNil(hovered)) {
    zones.get(hovered)?.onHover(false)
  }

  hovered = id

  if (!isNil(id)) {
    zones.get(id)?.onHover(true)
  }
}

async function start(): Promise<void> {
  if (hasStarted) {
    return
  }

  hasStarted = true
  const platform = await getPlatform()

  await platform.onFileDrop((event) => {
    if (event.type === 'leave') {
      setHovered(null)

      return
    }

    const id = zoneAt(event.x, event.y)

    setHovered(id)

    if (event.type !== 'drop' || isNil(id)) {
      return
    }

    const zone = zones.get(id)

    if (!zone) {
      return
    }

    setHovered(null)
    void linkDropped(zone, event.paths)
  })
}

/** A path with an extension is a file candidate, anything else is likely a folder. */
const looksLikeFile = (value: string): boolean => {
  return /\.[^\\/]+$/.test(value)
}

async function linkDropped(zone: DropZone, paths: string[]): Promise<void> {
  const candidates = paths.map((path) => {
    return { name: path, type: '' }
  })

  const { accepted, skipped } = acceptFiles({
    files: candidates,
    kinds: zone.kinds(),
    extensions: zone.extensions?.(),
  })

  const folders = candidates.filter((file) => {
    return !looksLikeFile(file.name)
  }).length

  const unsupported = skipped - folders

  if (folders > 0) {
    toast('Folders: use Add folder')
  }

  if (unsupported > 0) {
    const suffix = unsupported === 1 ? '' : 's'

    toast(`Skipped ${unsupported} unsupported file${suffix}`)
  }

  const items = await linkPaths(
    accepted.map((file) => {
      return file.name
    }),
  )

  if (items.length > 0) {
    zone.onUploaded(items)
  }
}
