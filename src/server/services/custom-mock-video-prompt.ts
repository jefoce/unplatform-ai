import 'server-only'

import {
  customMockVideoPrompt as readStoredPrompt,
  recordCustomMockVideoPrompt as storePrompt,
} from '../providers/mock/custom-video-prompts'

/** Stores the prompt the custom video mock last sent upstream, for the dev route. */
export function recordCustomMockVideoPrompt(prompt: string): void {
  storePrompt(prompt)
}

export function customMockVideoPrompt(): string | null {
  return readStoredPrompt()
}
