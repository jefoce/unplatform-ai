'use client'

import { arrayMove } from '@dnd-kit/sortable'
import { isNil, keyBy, uniqBy } from 'lodash-es'
import { toast } from 'sonner'

import type { UploadsById } from '@/core/api/uploads'
import { findImagePreset } from '@/core/presets/image'
import type {
  ImageAspectChoice,
  ImageBackground,
  ImageQuality,
  ImageResolution,
} from '@/core/presets/image/types'
import { type ImageGenerationInput, ImageInputSchema } from '@/core/schemas/image-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { referenceBlockReason } from '@/features/generator/reference-rules'
import { createDraftStore } from '@/lib/create-draft-store'

import { clampImageCount, imageDefaults, imageDraftForPreset } from './image-draft'
import { currentImagePreset, imageReferenceMax } from './preset'

interface ImageGeneratorState extends ImageGenerationInput {
  uploadsById: UploadsById
  setPreset: (id: string) => void
  setPrompt: (prompt: string) => void
  setCount: (count: number) => void
  setAspectRatio: (aspectRatio: ImageAspectChoice) => void
  setResolution: (resolution: ImageResolution | null) => void
  setQuality: (quality: ImageQuality | null) => void
  setBackground: (background: ImageBackground | null) => void
  setSeed: (seed: number | null) => void
  addReferences: (items: UploadItem[]) => void
  replaceReferences: (items: UploadItem[]) => void
  removeReference: (id: string) => void
  moveReference: (fromId: string, toId: string) => void
  replaceReference: (id: string, item: UploadItem) => void
  dropMissingReferences: (ids: string[]) => void
  upsertUploads: (items: UploadItem[]) => void
}

const INITIAL_PRESET = currentImagePreset('')

const INITIAL = {
  presetId: INITIAL_PRESET.id,
  prompt: '',
  ...imageDefaults(INITIAL_PRESET),
  references: [],
  uploadsById: {},
}

interface ClampedReferences {
  accepted: UploadItem[]
  skipped: number
  reason: string | null
}

interface ClampReferencesParams {
  items: UploadItem[]
  references: string[]
  max: number
}

/** Keeps the image uploads that fit the cap and explains the rest. */
function clampReferences(params: ClampReferencesParams): ClampedReferences {
  const { items, references, max } = params
  const current = new Set(references)

  const offered = uniqBy(items, 'id').filter((item) => {
    return !current.has(item.id)
  })

  const images = offered.filter((item) => {
    return item.kind === 'image'
  })

  const room = Math.max(0, max - references.length)
  const accepted = images.slice(0, room)
  const skipped = offered.length - accepted.length
  const hasForeign = images.length < offered.length

  let reason: string | null = null

  if (skipped > 0) {
    const kind = hasForeign ? 'video' : 'image'
    const kindMax = hasForeign ? 0 : max

    reason = referenceBlockReason({ kind, max: kindMax, room, isImageOnly: true })
  }

  return { accepted, skipped, reason }
}

/** Draft shared by the floating image prompt bar. */
/* eslint-disable max-lines-per-function -- one draft store owns every image action */
export const useImageGeneratorStore = createDraftStore<ImageGeneratorState, ImageGenerationInput>({
  name: 'unplatform-ai:image-draft',
  version: 1,
  schema: ImageInputSchema,
  create: (set, get) => {
    return {
      ...INITIAL,
      setPreset: (id) => {
        const preset = findImagePreset(id)

        if (!preset) {
          if (id.startsWith('custom.')) {
            set({ presetId: id })
          }

          return
        }

        const previous = get()
        const draft = imageDraftForPreset(previous, preset)

        set(draft)

        if (draft.references.length < previous.references.length) {
          toast(`Kept the first ${draft.references.length} references`)
        }
      },
      setPrompt: (prompt) => {
        set({ prompt })
      },
      setCount: (count) => {
        set({ count: clampImageCount(count) })
      },
      setAspectRatio: (aspectRatio) => {
        set({ aspectRatio })
      },
      setResolution: (resolution) => {
        set({ resolution })
      },
      setQuality: (quality) => {
        set({ quality })
      },
      setBackground: (background) => {
        set({ background })
      },
      setSeed: (seed) => {
        set({ seed })
      },
      addReferences: (items) => {
        const state = get()
        const preset = currentImagePreset(state.presetId)

        const { accepted, skipped, reason } = clampReferences({
          items,
          references: state.references,
          max: imageReferenceMax(preset),
        })

        set({
          references: [
            ...state.references,
            ...accepted.map((item) => {
              return item.id
            }),
          ],
          uploadsById: { ...state.uploadsById, ...keyBy(accepted, 'id') },
        })

        if (skipped > 0) {
          const suffix = skipped === 1 ? '' : 's'

          toast(`Skipped ${skipped} file${suffix} (${reason ?? 'unsupported file'})`)
        }
      },
      replaceReferences: (items) => {
        const state = get()
        const preset = currentImagePreset(state.presetId)

        const images = uniqBy(items, 'id')
          .filter((item) => {
            return item.kind === 'image'
          })
          .slice(0, imageReferenceMax(preset))

        set({
          references: images.map((item) => {
            return item.id
          }),
          uploadsById: { ...state.uploadsById, ...keyBy(images, 'id') },
        })
      },
      removeReference: (id) => {
        set((state) => {
          return {
            references: state.references.filter((reference) => {
              return reference !== id
            }),
          }
        })
      },
      moveReference: (fromId, toId) => {
        set((state) => {
          const from = state.references.indexOf(fromId)
          const to = state.references.indexOf(toId)

          if (from < 0 || to < 0 || from === to) {
            return state
          }

          return { references: arrayMove(state.references, from, to) }
        })
      },
      replaceReference: (id, item) => {
        set((state) => {
          return {
            references: state.references.map((reference) => {
              if (reference === id) {
                return item.id
              }

              return reference
            }),
            uploadsById: { ...state.uploadsById, [item.id]: item },
          }
        })
      },
      dropMissingReferences: (ids) => {
        const missing = new Set(ids)
        const { references } = get()

        const kept = references.filter((reference) => {
          return !missing.has(reference)
        })

        if (kept.length === references.length) {
          return
        }

        set({ references: kept })
        toast('Reference removed')
      },
      upsertUploads: (items) => {
        set((state) => {
          return { uploadsById: { ...state.uploadsById, ...keyBy(items, 'id') } }
        })
      },
    }
  },
  partialize: (state) => {
    return {
      presetId: state.presetId,
      prompt: state.prompt,
      count: state.count,
      aspectRatio: state.aspectRatio,
      resolution: state.resolution,
      quality: state.quality,
      background: state.background,
      references: state.references,
      seed: state.seed,
    }
  },
  normalize: (state) => {
    const found = findImagePreset(state.presetId)

    if (isNil(found) && state.presetId.startsWith('custom.')) {
      return {}
    }

    return imageDraftForPreset(state, found ?? currentImagePreset(state.presetId))
  },
})
/* eslint-enable max-lines-per-function */
