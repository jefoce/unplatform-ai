'use client'

import { isNil } from 'lodash-es'
import { AlertTriangle, Image as ImageIcon, Maximize2, X } from 'lucide-react'
import type { MouseEvent } from 'react'

import type { UploadItem } from '@/core/schemas/upload-item'
import { thumbUrl } from '@/lib/api/media-urls'
import { cn } from '@/lib/cn'

interface FrameSlotCardProps {
  label: string
  upload?: UploadItem
  hasFrame: boolean
  isBroken: boolean
  isPreviewable: boolean
  isDisabled: boolean
  onPress: () => void
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void
}

/** Visual frame slot with preview, replace and remove controls. */
export function FrameSlotCard(props: FrameSlotCardProps) {
  const { label, upload, hasFrame, isBroken, isPreviewable, isDisabled } = props
  const previewLabel = isPreviewable ? `Preview ${label.toLowerCase()}` : label

  return (
    <div
      className={cn(
        'group relative h-34 w-full rounded-2xl border border-dashed border-divider bg-surface p-2',
        isDisabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="relative size-full overflow-hidden rounded-sm">
        <button
          type="button"
          disabled={isDisabled}
          onClick={props.onPress}
          aria-label={previewLabel}
          className="absolute inset-0 z-0 size-full cursor-pointer disabled:cursor-not-allowed"
        />

        {!isNil(upload) && (
          // eslint-disable-next-line @next/next/no-img-element -- uploads are pre-sized thumbs
          <img
            src={thumbUrl({ ref: `uploads/${upload.id}`, w: 640 })}
            alt={label}
            className="pointer-events-none absolute inset-0 size-full rounded-[inherit] bg-black/40 object-contain"
          />
        )}

        {isBroken && (
          <span className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-danger/15 text-xs font-medium text-danger">
            <AlertTriangle size={20} aria-hidden />
            File missing
          </span>
        )}

        {isPreviewable && (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex size-7 items-center justify-center rounded-full bg-black/60 text-fg backdrop-blur-sm">
              <Maximize2 size={12} aria-hidden />
            </span>
          </span>
        )}

        {!hasFrame && (
          <>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-full bg-white/4 text-fg-2 mix-blend-luminosity shadow-[0_128.852px_36.007px_rgba(0,0,0,0),0_82.429px_33.031px_rgba(0,0,0,0.01),0_46.422px_27.972px_rgba(0,0,0,0.05),0_20.533px_20.533px_rgba(0,0,0,0.09),0_5.059px_11.308px_rgba(0,0,0,0.1),inset_0_-0.298px_5.356px_rgba(185,185,185,0.35)] backdrop-blur-xs linux:bg-surface-2">
                <ImageIcon size={16} />
              </span>
              <span className="cursor-default text-sm font-medium text-fg-2">{label}</span>
            </div>
            <span className="pointer-events-none absolute top-0 right-0 rounded-3xl bg-white/5 px-1.5 py-1 text-3xs font-normal text-fg-2 backdrop-blur-sm linux:bg-surface-2">
              Optional
            </span>
          </>
        )}
      </div>

      {hasFrame && (
        <button
          type="button"
          onClick={props.onRemove}
          aria-label={`Remove ${label.toLowerCase()}`}
          className={cn(
            'absolute -top-1.5 -right-1.5 z-20 size-6 items-center justify-center rounded-full bg-black/70 text-fg backdrop-blur-sm hover:bg-black',
            isBroken && 'flex',
            !isBroken && 'hidden group-hover:flex',
          )}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}
