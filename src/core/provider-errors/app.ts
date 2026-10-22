import type { Rule } from './types'

export const APP_RULES: readonly Rule[] = [
  {
    match: 'Interrupted while sending',
    title: 'The app closed while sending.',
    hint: 'Check OpenRouter activity before rerun, the job may exist.',
    kind: 'app',
  },
  {
    match: 'Interrupted while uploading inputs',
    title: 'The upload was interrupted.',
    hint: 'Reuse the settings and try again.',
    kind: 'app',
  },
  {
    match: 'Not started: the app was closed before it was sent',
    title: 'The app closed before sending.',
    hint: 'Reuse to send it again.',
    kind: 'app',
  },
  {
    match: 'OpenRouter copy expired before download',
    title: 'The finished video was not saved.',
    hint: 'OpenRouter no longer had the file. Check OpenRouter activity for the charge.',
    kind: 'app',
  },
  {
    match: 'Job expired',
    title: 'The model did not finish in time.',
    hint: 'Try again.',
    kind: 'app',
  },
  {
    match: 'Disk is full',
    title: 'The disk is full.',
    hint: 'Free some space. The download retries every minute.',
    kind: 'app',
  },
  {
    match: 'Download failed',
    title: 'The video could not be saved.',
    hint: 'Try the download again.',
    kind: 'app',
  },
  {
    match: 'Job not found on OpenRouter',
    title: 'OpenRouter no longer has this job.',
    hint: 'Check OpenRouter activity before trying again.',
    kind: 'app',
  },
  {
    match: 'OpenRouter auth failed',
    title: 'OpenRouter rejected the key.',
    hint: 'Open Settings and paste a valid key.',
    kind: 'account',
  },
  {
    match: 'key is not set',
    title: 'Your OpenRouter key is not set.',
    hint: 'Open Settings and paste a key.',
    kind: 'account',
  },
  {
    match: 'Input file was removed before submit',
    title: 'A reference was removed before sending.',
    hint: 'Reuse the settings and add it again.',
    kind: 'app',
  },
  {
    match: 'Inputs too large in total',
    title: 'The references are too large together.',
    hint: 'Use fewer or smaller files.',
    kind: 'input',
  },
]
