'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isEmpty, isNil } from 'lodash-es'
import type { ClipboardEvent } from 'react'
import { toast } from 'sonner'

import { acceptFiles, type KindExtensions, pastedPath } from '@/core/media-kinds'
import type { MediaKind, UploadItem } from '@/core/types'
import { errorMessage } from '@/lib/errors'

import { linkAbsPath } from './api'

export interface PasteMediaOptions {
  enabled: boolean
  scope: 'window' | 'element'
  kinds: () => readonly MediaKind[]
  extensions?: () => KindExtensions | undefined
  onFiles: (files: File[]) => void
  onUploaded: (items: UploadItem[]) => void
}

interface PasteLike {
  clipboardData: DataTransfer | null
  target: EventTarget | null
  preventDefault: () => void
}

interface PastedFilesParams {
  event: PasteLike
  files: File[]
  params: PasteMediaOptions
}

const EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"], [contenteditable=""]'

function handlePastedFiles(params: PastedFilesParams): void {
  const { event, files, params: options } = params
  const { accepted, skipped } = acceptFiles({
    files,
    kinds: options.kinds(),
    extensions: options.extensions?.(),
  })

  if (skipped > 0) toast(`Skipped ${skipped} unsupported file${skipped === 1 ? '' : 's'}`)

  if (isEmpty(accepted)) return

  event.preventDefault()
  options.onFiles(accepted)
}

function handlePastedPath(event: PasteLike, params: PasteMediaOptions): void {
  const path = pastedPath({
    text: event.clipboardData?.getData('text/plain') ?? '',
    kinds: params.kinds(),
    extensions: params.extensions?.(),
  })

  if (isNil(path) || path === '') return

  event.preventDefault()
  void linkAbsPath(path)
    .then((item) => params.onUploaded([item]))
    .catch((error) => toast.error(errorMessage(error)))
}

interface PasteTarget {
  files: File[]
  isEditing: boolean
  isInPromptEditor: boolean
}

function readPasteTarget(event: PasteLike): PasteTarget {
  const target = event.target instanceof HTMLElement ? event.target : null
  const files = Array.from(event.clipboardData?.files ?? [])

  return {
    files,
    isEditing: Boolean(target?.closest(EDITABLE_SELECTOR)),
    isInPromptEditor: Boolean(target?.closest('[data-prompt-editor]')),
  }
}

function handlePaste(event: PasteLike, params: PasteMediaOptions): void {
  if (!params.enabled) return

  const { files, isEditing, isInPromptEditor } = readPasteTarget(event)
  const isPromptPaste = isInPromptEditor && files.length > 0

  if (isEditing && !isPromptPaste) return

  if (files.length > 0) {
    handlePastedFiles({ event, files, params })

    return
  }

  handlePastedPath(event, params)
}

/** One paste behavior for the picker (window) and the generator panel (element). */
export function usePasteMedia(params: PasteMediaOptions): {
  onPaste?: (event: ClipboardEvent<HTMLElement>) => void
} {
  const { enabled: isEnabled, scope } = params
  const current = useRef(params)

  useEffect(() => {
    current.current = params
  })

  const onPaste = useCallback((event: ClipboardEvent<HTMLElement>) => {
    handlePaste(event, current.current)
  }, [])

  useEffect(() => {
    if (scope !== 'window' || !isEnabled) return

    const listener = (event: globalThis.ClipboardEvent) => handlePaste(event, current.current)

    window.addEventListener('paste', listener)

    return () => window.removeEventListener('paste', listener)
  }, [scope, isEnabled])

  if (scope === 'element') return { onPaste }

  return {}
}
