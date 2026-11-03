'use client'

import { type ReactNode, useCallback, useMemo } from 'react'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { defineExtension, type EditorState } from 'lexical'
import { BeautifulMentionsPlugin, createBeautifulMentionNode } from 'lexical-beautiful-mentions'
import { isNil } from 'lodash-es'

import type { ValidationIssue } from '@/core/validation/common'

import { AudioChip } from '../options/AudioChip'
import { SeedChip } from '../options/SeedChip'
import { ReferenceChip } from '../references/ReferenceChip'
import { ReferencePickerMenu } from '../references/ReferencePickerMenu'
import { ReferencePickerMenuItem } from '../references/ReferencePickerMenuItem'
import {
  mentionItems,
  type PromptMentionInserter,
  type PromptMentions,
  type PromptSlotFocuser,
  serializeEditor,
} from './prompt-convert'
import { PromptEditorBridge } from './PromptEditorBridge'
import { PromptMentionsProvider } from './PromptMentionsProvider'
import { PromptWarnings } from './PromptWarnings'

const PLACEHOLDER = 'Describe the video. Refer to inputs as Image 1, Video 1, or Audio 1'

const DEFAULT_EDITOR_CLASS =
  'block min-h-33 w-full p-3 text-sm/5 wrap-break-word whitespace-pre-wrap outline-none'

const EDITOR_NODES = createBeautifulMentionNode(ReferenceChip)

const EMPTY_MENTIONS: PromptMentions = { references: [], uploadsById: {} }

function placeholderClassFor(isInline: boolean): string {
  if (isInline) {
    return 'pointer-events-none absolute top-2 left-0 text-sm/5 text-fg-2'
  }

  return 'pointer-events-none absolute top-3 left-3 text-sm/5 text-fg-2'
}

function contentClassFor(className?: string): string {
  return className ?? DEFAULT_EDITOR_CLASS
}

/** Remount key when the editor switches between panel, references and inline. */
function editorKeyFor(isInline: boolean, isMentions: boolean): string {
  if (isInline) {
    return 'inline'
  }

  if (isMentions) {
    return 'references'
  }

  return 'panel'
}

function handleEditorError(error: Error): void {
  throw error
}

// Module scope keeps the extension identity stable so the editor is not rebuilt.
const EDITOR_EXTENSION = defineExtension({
  name: 'prompt-editor',
  namespace: 'prompt-editor',
  nodes: [...EDITOR_NODES],
  onError: handleEditorError,
})

interface PromptFieldProps {
  value: string
  onSubmit: () => void
  onChange: (value: string) => void
  warnings?: ValidationIssue[]
  placeholder?: string
  editorClassName?: string
  isInline?: boolean
  isReferences?: boolean
  mentions?: PromptMentions | null
  footerEnd?: ReactNode
  onFocusSlot?: PromptSlotFocuser
  onRegisterInserter?: (fn: PromptMentionInserter | null) => void
  onRegisterFocuser?: (fn: PromptSlotFocuser | null) => void
}

/** Lexical prompt editor with a controlled value and optional reference chips. */
export function PromptField(props: PromptFieldProps) {
  const {
    value: prompt,
    onChange,
    warnings = [],
    placeholder = PLACEHOLDER,
    isInline = false,
    isReferences = true,
    mentions = null,
  } = props

  const isMentions = isReferences && !isNil(mentions)

  const items = useMemo(() => {
    return mentionItems(mentions ?? EMPTY_MENTIONS)
  }, [mentions])

  const handleChange = useCallback(
    (state: EditorState) => {
      onChange(serializeEditor(state))
    },
    [onChange],
  )

  const placeholderClass = placeholderClassFor(isInline)
  const contentClass = contentClassFor(props.editorClassName)
  const editorKey = editorKeyFor(isInline, isMentions)

  // Provider sits above the composer: mention decorators render outside its children.
  const editor = (
    <PromptMentionsProvider mentions={mentions}>
      <LexicalExtensionComposer key={editorKey} extension={EDITOR_EXTENSION} contentEditable={null}>
        <div className="relative" data-prompt-editor>
          <PlainTextPlugin
            contentEditable={<ContentEditable aria-label="Prompt" className={contentClass} />}
            placeholder={<p className={placeholderClass}>{placeholder}</p>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
          <HistoryPlugin />
          <PromptEditorBridge
            prompt={prompt}
            onSubmit={props.onSubmit}
            isReferences={isReferences}
            mentions={mentions}
            onRegisterInserter={props.onRegisterInserter}
            onRegisterFocuser={props.onRegisterFocuser}
          />
          {isMentions && (
            <BeautifulMentionsPlugin
              items={items}
              triggers={['@']}
              creatable={false}
              allowSpaces={false}
              menuComponent={ReferencePickerMenu}
              menuItemComponent={ReferencePickerMenuItem}
            />
          )}
        </div>
      </LexicalExtensionComposer>
    </PromptMentionsProvider>
  )

  if (isInline) {
    return editor
  }

  return (
    <div className="mt-4 min-h-40 rounded-xl border border-line bg-surface">
      <div className="max-h-50 overflow-y-auto">
        <div className="px-3 pt-3 text-sm/5 font-medium text-fg-2">Prompt</div>
        {editor}
      </div>
      <div
        data-prompt-footer
        className="flex items-center gap-1 rounded-b-xl bg-surface px-3 pt-2 pb-3"
      >
        <AudioChip />
        <SeedChip />
        <div className="ml-auto flex min-w-0 items-center gap-1">
          <PromptWarnings warnings={warnings} onFocus={props.onFocusSlot} className="ml-0" />
          {props.footerEnd}
        </div>
      </div>
    </div>
  )
}
