interface FriendlyRule {
  test: RegExp
  text: string
}

const FRIENDLY_RULES = [
  {
    test: /not allowed by acl/i,
    text: 'This action is not available in this build. Update the app.',
  },
  {
    test: /not allowed on the configured scope|not allowed: /i,
    text: 'The app cannot open that link.',
  },
  {
    test: /no handler|failed to open|open failed/i,
    text: 'The app could not open that file.',
  },
  {
    test: /signature|verification failed/i,
    text: 'The update could not be verified. Download it from the release page.',
  },
  {
    test: /could not fetch|failed to fetch|release json|network error|request failed/i,
    text: 'Could not reach the update server. Check your connection and try again.',
  },
  { test: /no update found/i, text: 'No update is available.' },
  {
    test: /path must be absolute/i,
    text: 'The app could not save the file there. Pick another location.',
  },
  {
    test: /only \.mp4 files/i,
    text: 'The file name must end with .mp4.',
  },
  {
    test: /target must be a regular file/i,
    text: 'That name belongs to something that is not a file. Pick another name.',
  },
  {
    test: /folder must be a real directory/i,
    text: 'That folder cannot be written to. Pick another folder.',
  },
  {
    test: /^forbidden$/i,
    text: 'The app cannot write to that location. Pick it again.',
  },
  { test: /not found/i, text: 'The file is no longer on disk.' },
  { test: /unknown\s*error/i, text: 'The app could not complete that action.' },
] satisfies readonly FriendlyRule[]

/** Short user text for a known raw failure, or null when the raw text is already readable. */
export function friendlyText(raw: string): string | null {
  const rule = FRIENDLY_RULES.find((entry) => {
    return entry.test.test(raw)
  })

  return rule?.text ?? null
}
