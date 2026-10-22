import type { TestMessage } from './use-secrets'

const MESSAGE_TONES = {
  ok: 'text-lime',
  error: 'text-danger',
  info: 'text-fg-2',
} satisfies Record<TestMessage['tone'], string>

interface TestMessageLineProps {
  result: TestMessage | null
}

/** Test outcome line, colored by tone. */
export function TestMessageLine(props: TestMessageLineProps) {
  const { result } = props

  if (!result) return null

  return <p className={`text-xxs ${MESSAGE_TONES[result.tone]}`}>{result.text}</p>
}
