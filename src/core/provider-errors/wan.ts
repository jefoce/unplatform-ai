import { settingTitle } from './helpers'
import type { Rule } from './types'

export const WAN_RULES: readonly Rule[] = [
  {
    match: (raw: string): boolean => {
      return /DataInspectionFailed/.test(raw) && /output data/i.test(raw)
    },
    title: "The finished video was blocked by Wan's content check.",
    hint: 'Change the prompt or the seed.',
    kind: 'content',
  },
  {
    match: /DataInspectionFailed/,
    title: "Wan's content check flagged your prompt or a reference.",
    hint: 'Change it and try again.',
    kind: 'content',
  },
  {
    match: /green network verification/i,
    title: "Wan's content check flagged a reference image.",
    hint: 'Replace it and try again.',
    kind: 'content',
  },
  {
    match: /IPInfringementSuspect/,
    title: 'Your prompt or references may be copyrighted.',
    hint: 'Remove brands, known characters or known works.',
    kind: 'copyright',
  },
  {
    match: /CustomRoleBlocked|FaqRuleBlocked/,
    title: 'The request was blocked by a provider rule.',
    hint: 'Change the prompt or references.',
    kind: 'content',
  },
  {
    match: /InvalidFile\.Size|Multimodal file size is too large/i,
    title: 'A reference file is too large for Wan.',
    hint: 'Use a smaller file.',
    kind: 'input',
  },
  {
    match: /InvalidFile\.Format|InvalidImageFormat/,
    title: 'Wan does not accept one of the file formats.',
    hint: 'Images: JPEG, PNG, BMP, WEBP. Video: mp4, mov. Audio: wav, mp3.',
    kind: 'input',
  },
  {
    match: /InvalidFile\.Duration/,
    title: 'A reference clip is too short or too long.',
    hint: 'Each clip 1-15 s.',
    kind: 'input',
  },
  {
    match:
      /InvalidFile\.Resolution|InvalidImageResolution|InvalidImage\.ImageSize|InvalidFile\.AspectRatio|InvalidFile\.FPS/,
    title: "A reference does not fit Wan's size, shape or frame rate limits.",
    hint: 'See the limits in the reference tooltip.',
    kind: 'input',
  },
  {
    match: /InvalidFile\.Openerror/,
    title: 'Wan could not open one of the references.',
    hint: 'Export it again and retry.',
    kind: 'input',
  },
  {
    match: (raw: string): boolean => {
      return (
        /InvalidURL|InputDownloadFailed|InvalidFile\.DownloadFailed|InvalidParameter\.DataInspection/.test(
          raw,
        ) ||
        /authorization to access the media resource/i.test(raw) ||
        /Failed to find the requested media resource/i.test(raw)
      )
    },
    title: 'Wan could not download a reference from your storage.',
    hint: 'Check R2 in Settings, then try again. Links expire after the time set in Settings.',
    kind: 'input',
  },
  {
    match: /InvalidParameter/,
    title: (raw: string): string => {
      return settingTitle('Wan', raw)
    },
    hint: 'The app should have caught this. Send the details to the developer.',
    kind: 'input',
  },
  {
    match: (raw: string): boolean => {
      return /Throttling/.test(raw) || /Too many requests/i.test(raw)
    },
    title: 'Wan is busy right now.',
    hint: 'Try again in a few minutes.',
    kind: 'busy',
    retry: true,
  },
  {
    match: /Arrearage|AccessDenied|BudgetLimitExceeded|PostpaidBillOverdue|AllocationQuota/,
    title: "The provider refused the request on OpenRouter's side.",
    hint: 'Try again later. If it repeats, check OpenRouter status.',
    kind: 'account',
  },
  {
    match: /InternalError/,
    title: 'Wan had an internal error.',
    hint: 'Try again.',
    kind: 'provider',
    retry: true,
  },
]
