'use client'

import { isNil } from 'lodash-es'
import { Lock } from 'lucide-react'

import { showPrice } from '@/core/pricing/visibility'
import { canonicalizePrompt } from '@/core/prompt-tokens'
import { recordSource, sourceTitle } from '@/core/record-source'
import type { GenerationRecord } from '@/core/schemas/generation-record'
import type { ImageRecord } from '@/core/schemas/image-record'
import { ACTIVE_STATUSES } from '@/core/types'
import { currentImagePreset } from '@/features/image-generator/preset'
import { useImageGeneratorStore } from '@/features/image-generator/store'
import { setWorkspaceTab } from '@/features/shared/use-workspace-tab'
import { cn } from '@/lib/cn'
import {
  type HistoryItem,
  type ImageGridItem,
  imageRecordSlots,
  isVideoItem,
  recordSlots,
} from '@/lib/feed/output-items'
import { useNow } from '@/lib/use-now'
import { Tooltip } from '@/ui/Tooltip'

import { costInfo, imageCostInfo, imageOutputSeed, imageSettingLabels } from './details-info'
import { DetailsActions } from './DetailsActions'
import { DetailsPrompt } from './DetailsPrompt'
import { DetailsSettings } from './DetailsSettings'
import { DetailsSource } from './DetailsSource'
import { ImageActions } from './ImageActions'
import { InputThumbs } from './InputThumbs'
import { imageReferenceThumbItems, thumbItems } from './thumb-item'

const SETTING_CLASSES =
  'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-lg bg-surface py-1.25 pl-1.5 pr-2.5 text-xxs font-semibold text-fg'

interface DetailsPanelProps {
  item: HistoryItem
  onDeleted?: () => void

  /** Keeps the model chip and price clear of the viewer close button. */
  topRightInset?: boolean
}

interface PanelHeader {
  title: string
  costText: string
  costNote: string
}

function isLocalFree(record: GenerationRecord | ImageRecord, usd: number): boolean {
  return !showPrice(recordSource(record), usd)
}

function costTextFor(record: GenerationRecord | ImageRecord, text: string): string {
  const usd = record.cost.actualUsd ?? record.cost.estimatedUsd

  if (isLocalFree(record, usd)) {
    return ''
  }

  return text
}

/** Model, price and its note for either kind. Local zero prices are hidden. */
function panelHeader(item: HistoryItem): PanelHeader {
  if (isVideoItem(item)) {
    const cost = costInfo(item.source)

    return {
      title: sourceTitle(recordSource(item.source)),
      costText: costTextFor(item.source, cost.text),
      costNote: cost.note,
    }
  }

  const cost = imageCostInfo(item)

  return {
    title: sourceTitle(recordSource(item.source)),
    costText: costTextFor(item.source, cost.text),
    costNote: cost.note,
  }
}

interface VideoBodyParams {
  record: GenerationRecord
  isActive: boolean
  now: number
  onDeleted?: () => void
}

/** Prompt, inputs, settings and actions for one video record. */
function videoBody(params: VideoBodyParams) {
  const { record, isActive, now } = params
  const { counts, slots } = recordSlots(record)
  const plain = canonicalizePrompt(record.input.prompt, counts)

  return (
    <>
      <DetailsPrompt plain={plain} counts={counts} slots={slots} snapshot={record.inputsSnapshot} />
      <InputThumbs items={thumbItems(record)} />
      <DetailsSettings record={record} />
      <DetailsActions record={record} isActive={isActive} now={now} onDeleted={params.onDeleted} />
    </>
  )
}

/** Setting chips the record preset supports, plus its output seed. */
function imageSettings(item: ImageGridItem) {
  const labels = imageSettingLabels(item.source.input)
  const seed = imageOutputSeed(item)

  const handleUseSeed = () => {
    if (isNil(seed)) {
      return
    }

    const store = useImageGeneratorStore.getState()

    store.setPreset(item.source.input.presetId)

    const nextPreset = currentImagePreset(useImageGeneratorStore.getState().presetId)
    const nextSeed = nextPreset.seed ? seed : null

    store.setSeed(nextSeed)
    setWorkspaceTab('image')
  }

  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => {
        return (
          <span key={label} className={SETTING_CLASSES}>
            {label}
          </span>
        )
      })}
      {!isNil(seed) && (
        <span className={SETTING_CLASSES}>
          <Lock size={14} className="text-fg-2" aria-hidden />
          Seed {seed}
        </span>
      )}
      {!isNil(seed) && (
        <button
          type="button"
          onClick={handleUseSeed}
          className="inline-flex h-6 items-center rounded-lg bg-surface px-2.5 text-xxs font-semibold text-fg transition hover:bg-hover focus-visible:bg-hover"
        >
          Use seed
        </button>
      )}
    </div>
  )
}

/** Prompt, supported settings and actions for one image output. */
function imageBody(params: ImageBodyParams) {
  const { item } = params
  const { counts, slots } = imageRecordSlots(item.source)
  const plain = canonicalizePrompt(item.source.input.prompt, counts)

  return (
    <>
      <DetailsPrompt
        plain={plain}
        counts={counts}
        slots={slots}
        snapshot={item.source.inputsSnapshot ?? {}}
      />
      <InputThumbs items={imageReferenceThumbItems(item.source)} />
      {imageSettings(item)}
      <ImageActions item={item} onDeleted={params.onDeleted} />
    </>
  )
}

interface ImageBodyParams {
  item: ImageGridItem
  onDeleted?: () => void
}

interface BodyParams {
  item: HistoryItem
  isActive: boolean
  now: number
  onDeleted?: () => void
}

interface BodyParams {
  item: HistoryItem
  isActive: boolean
  now: number
  onDeleted?: () => void
}

function body(params: BodyParams) {
  if (isVideoItem(params.item)) {
    return videoBody({
      record: params.item.source,
      isActive: params.isActive,
      now: params.now,
      onDeleted: params.onDeleted,
    })
  }

  return imageBody({ item: params.item, onDeleted: params.onDeleted })
}

/** Details for one grid item, video or image. */
export function DetailsPanel(props: DetailsPanelProps) {
  const { item, topRightInset: hasTopRightInset = false } = props
  const isActive = isVideoItem(item) && ACTIVE_STATUSES.includes(item.source.status)
  const now = useNow(isActive)
  const header = panelHeader(item)

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-page-2 p-3 pb-4">
      <div className={cn('flex items-center justify-between gap-2', hasTopRightInset && 'pr-10')}>
        <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pr-2 pl-1.5 text-xxs font-semibold text-fg">
          {header.title}
        </span>
        {header.costText !== '' && (
          <Tooltip content={header.costNote}>
            <span className="inline-flex h-6 min-w-0 items-center truncate rounded-lg border border-divider bg-transparent pr-2 pl-1.5 text-xxs font-semibold text-fg">
              {header.costText}
            </span>
          </Tooltip>
        )}
      </div>

      <DetailsSource record={item.source} />

      {body({ item, isActive, now, onDeleted: props.onDeleted })}
    </div>
  )
}
