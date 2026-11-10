import 'server-only'

import { globalState } from '../../global-state'

interface CustomMockVideoPromptStore {
  value: string | null
}

const promptStore = globalState<CustomMockVideoPromptStore>('customMockVideoPrompt', () => {
  return { value: null }
})

/** Last prompt rendered for the API, read back by the e2e route. */
export function recordCustomMockVideoPrompt(prompt: string): void {
  promptStore.value = prompt
}

export function customMockVideoPrompt(): string | null {
  return promptStore.value
}
