import 'server-only'

import { globalState } from '../../global-state'

interface CustomMockImagePromptStore {
  value: string | null
}

const promptStore = globalState<CustomMockImagePromptStore>('customMockImagePrompt', () => {
  return { value: null }
})

/** Last prompt rendered for the API, read back by the e2e route. */
export function recordCustomMockImagePrompt(prompt: string): void {
  promptStore.value = prompt
}

export function customMockImagePrompt(): string | null {
  return promptStore.value
}
