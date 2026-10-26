import type { StoreApi } from 'zustand'

import type { AspectChoice, Resolution } from '@/core/presets/types'
import type { RefSlot } from '@/core/prompt-tokens'
import type { GenerationInput, GeneratorTab } from '@/core/schemas/generation-record'
import type { UploadItem, UploadsById } from '@/core/schemas/upload-item'

import type { GeneratorDraft } from './store-draft'

type MentionInserter = (slot: RefSlot) => void

type SlotFocuser = (slot: RefSlot, occurrence: number) => void

export interface GeneratorState extends GeneratorDraft {
  uploadsById: UploadsById
  activeCount: number
  setActiveCount: (count: number) => void
  setPreset: (id: string) => void
  setTab: (tab: GeneratorTab) => void
  setPrompt: (text: string) => void
  setAudio: (audio: boolean) => void
  setDuration: (duration: number) => void
  setAspectRatio: (aspectRatio: AspectChoice) => void
  setResolution: (resolution: Resolution) => void
  setFrame: (slot: 'start' | 'end', upload: UploadItem | null) => void
  addReferences: (uploads: UploadItem[]) => void
  replaceReference: (id: string, upload: UploadItem) => void
  removeReference: (id: string) => void
  insertMention: (slot: RefSlot) => void
  focusSlot: (slot: RefSlot, occurrence: number) => void
  setSeed: (seed: number | null) => void
  toggleSeedLock: () => void
  loadInput: (input: GenerationInput, uploads: UploadItem[]) => void
  normalizeLoaded: () => void
  reset: () => void
  registerMentionInserter: (fn: MentionInserter | null) => void
  registerSlotFocuser: (fn: SlotFocuser | null) => void
  upsertUploads: (uploads: UploadItem[]) => void
}

export type GeneratorSetState = StoreApi<GeneratorState>['setState']

export type GeneratorGetState = StoreApi<GeneratorState>['getState']
