import type { Rule } from '../../provider-errors/types'
import type { ProviderKindId } from '../../providers/types'

/** Family rules for raw `upai:<code>: <message>` adapter text. */
export const CUSTOM_ERROR_RULES: readonly Rule[] = [
  {
    match: 'upai:unauthorized',
    title: 'The endpoint token is not valid.',
    hint: 'Open Settings and paste the token.',
    kind: 'account',
  },
  {
    match: 'upai:forbidden',
    title: 'ComfyUI refused this computer.',
    hint: 'Enable LAN access in ComfyUI or add a token.',
    kind: 'account',
  },
  {
    match: 'upai:invalid_request',
    title: 'The workflow does not accept these settings.',
    hint: 'Check the workflow fields.',
    kind: 'input',
  },
  {
    match: 'upai:model_not_found',
    title: 'This workflow is gone from ComfyUI.',
    hint: 'Save it again in ComfyUI.',
    kind: 'input',
  },
  {
    match: 'upai:workflow_invalid',
    title: 'ComfyUI rejected the workflow.',
    hint: 'Open it in ComfyUI and run it once.',
    kind: 'provider',
  },
  {
    match: 'upai:too_large',
    title: 'The file is too large for ComfyUI.',
    hint: 'Use a smaller file or raise the limit in ComfyUI.',
    kind: 'input',
  },
  {
    match: 'upai:queue_full',
    title: 'The ComfyUI queue is full.',
    hint: 'Wait and try again.',
    kind: 'busy',
    retry: true,
  },
  {
    match: 'upai:job_failed',
    title: 'ComfyUI failed this job.',
    kind: 'provider',
  },
  {
    match: 'upai:comfy_unavailable',
    title: 'ComfyUI is not reachable.',
    hint: 'Start ComfyUI, then try again.',
    kind: 'provider',
    retry: true,
  },
  {
    match: 'upai:config_invalid',
    title: 'The ComfyUI pack settings are broken.',
    hint: 'Fix config.json in ComfyUI.',
    kind: 'account',
  },
  {
    match: /upai:(?:timeout|internal)\b/,
    title: 'ComfyUI did not answer in time.',
    hint: 'Try again.',
    kind: 'provider',
    retry: true,
  },
  {
    match: 'upai:endpoint_removed',
    title: 'This endpoint was removed.',
    kind: 'account',
  },
]

/** Preset rules when the runtime preset is gone but the record is from a custom endpoint. */
export function fallbackErrorRules(provider: ProviderKindId): readonly Rule[] {
  if (provider === 'custom') {
    return CUSTOM_ERROR_RULES
  }

  return []
}
