'use client'

import { useCallback, useMemo } from 'react'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin'
import { defineExtension, type EditorState } from 'lexical'
import { BeautifulMentionsPlugin, createBeautifulMentionNode } from 'lexical-beautiful-mentions'

import type { ValidationIssue } from '@/core/validation-types'

import { AudioChip } from '../options/AudioChip'
import { SeedChip } from '../options/SeedChip'
import { ReferenceChip } from '../references/ReferenceChip'
import { ReferencePickerMenu } from '../references/ReferencePickerMenu'
import { ReferencePickerMenuItem } from '../references/ReferencePickerMenuItem'
import { useGeneratorStore } from '../store/store'
import { promptFor } from '../store/store-draft'
import { mentionItems, serializeEditor } from './prompt-convert'
import { PromptEditorBridge } from './PromptEditorBridge'
import { PromptWarnings } from './PromptWarnings'

const PLACEHOLDER = 'Describe the video. Refer to inputs as Image 1, Video 1, or Audio 1'
const EDITOR_NODES = createBeautifulMentionNode(ReferenceChip)

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
  onSubmit: () => void
  warnings: ValidationIssue[]
}

/** Lexical prompt editor with per-mode drafts, live reference chips and warning chip. */
export function PromptField(props: PromptFieldProps) {
  const { warnings } = props
  const prompt = useGeneratorStore(promptFor)

  const setPrompt = useGeneratorStore((state) => {
    return state.setPrompt
  })

  const tab = useGeneratorStore((state) => {
    return state.tab
  })

  const references = useGeneratorStore((state) => {
    return state.references
  })

  const uploadsById = useGeneratorStore((state) => {
    return state.uploadsById
  })

  const focusSlot = useGeneratorStore((state) => {
    return state.focusSlot
  })

  const items = useMemo(() => {
    return mentionItems({ references, uploadsById })
  }, [references, uploadsById])

  const handleChange = useCallback(
    (state: EditorState) => {
      setPrompt(serializeEditor(state))
    },
    [setPrompt],
  )

  return (
    <div className="mt-4 min-h-40 rounded-xl border border-line bg-surface">
      <div className="max-h-50 overflow-y-auto">
        <div className="px-3 pt-3 text-sm/5 font-medium text-fg-2">Prompt</div>
        <LexicalExtensionComposer key={tab} extension={EDITOR_EXTENSION} contentEditable={null}>
          <div className="relative" data-prompt-editor>
            <PlainTextPlugin
              contentEditable={
                <ContentEditable
                  aria-label="Prompt"
                  className="block min-h-33 w-full p-3 text-sm/5 wrap-break-word whitespace-pre-wrap outline-none"
                />
              }
              placeholder={
                <p className="pointer-events-none absolute top-3 left-3 text-sm/5 text-fg-2">
                  {PLACEHOLDER}
                </p>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
            <HistoryPlugin />
            <PromptEditorBridge prompt={prompt} onSubmit={props.onSubmit} />
            {tab === 'references' && (
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
      </div>
      <div className="flex items-center gap-1 rounded-b-xl bg-surface px-3 pt-2 pb-3">
        <AudioChip />
        <SeedChip />
        <PromptWarnings warnings={warnings} onFocus={focusSlot} />
      </div>
    </div>
  )
}
