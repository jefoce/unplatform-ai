import 'server-only'

import {
  customMockImagePrompt as readStoredPrompt,
  recordCustomMockImagePrompt as storePrompt,
} from '../providers/mock/custom-image-prompts'

/** Stores the prompt the custom image mock last sent upstream, for the dev route. */
export function recordCustomMockImagePrompt(prompt: string): void {
  storePrompt(prompt)
}

export function customMockImagePrompt(): string | null {
  return readStoredPrompt()
}
