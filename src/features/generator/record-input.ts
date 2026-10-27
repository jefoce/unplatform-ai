import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { UploadItem } from '@/core/schemas/upload-item'
import { captureGenerationFrame } from '@/lib/api/generations'
import { linkGenerationFile } from '@/lib/api/uploads'

import { useGeneratorStore } from './store/store'

/** Captures a frame of a finished video and arms it as the start frame. */
export async function captureFrameAt(
  record: GenerationRecord,
  at: 'first' | 'last',
): Promise<UploadItem> {
  const upload = await captureGenerationFrame(record.id, at)
  const store = useGeneratorStore.getState()

  if (store.tab !== 'frames') {
    store.setTab('frames')
  }

  store.setFrame('start', upload)

  return upload
}

/** Last frame alias, the path the generator use button takes. */
function captureRecordFrame(record: GenerationRecord): Promise<UploadItem> {
  return captureFrameAt(record, 'last')
}

/** Links a finished video as a reference and shows the references tab. */
export async function linkRecordReference(record: GenerationRecord): Promise<UploadItem> {
  const upload = await linkGenerationFile({ generationId: record.id })
  const store = useGeneratorStore.getState()

  if (store.tab !== 'references') {
    store.setTab('references')
  }

  store.addReferences([upload])

  return upload
}

/** Applies a record to the active tab, true when the store kept the input. */
export async function applyRecordToGenerator(record: GenerationRecord): Promise<boolean> {
  if (useGeneratorStore.getState().tab === 'frames') {
    const upload = await captureRecordFrame(record)

    return useGeneratorStore.getState().frames.start === upload.id
  }

  const upload = await linkRecordReference(record)

  return useGeneratorStore.getState().references.includes(upload.id)
}
