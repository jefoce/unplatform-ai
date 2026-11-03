import type { Dict } from '../../src/core/utility-types'

/** Preset titles and the family bullet that covers them. */
export const PRESET_FAMILIES: Dict<string> = {
  'Wan 3.0': 'Wan',
  'Wan 3.0 Prime': 'Wan',
  'Seedance 2.0': 'Seedance',
  'Seedance 2.5': 'Seedance',
  'Nano Banana': 'Nano Banana',
  'Nano Banana Pro': 'Nano Banana',
  'Nano Banana 2': 'Nano Banana',
  'Nano Banana 2 Lite': 'Nano Banana',
  'Nano Banana 2.1': 'Nano Banana',
  'Seedream 5 Flash': 'Seedream',
  'Seedream 5 Lite': 'Seedream',
  'Seedream 5 Pro': 'Seedream',
  'GPT Image 2.5 Flare': 'GPT Image',
  'GPT Image 2.5 Sunburst': 'GPT Image',
  'GPT Image 2': 'GPT Image',
  'FLUX 3 Klein': 'FLUX',
}

const MODEL_QUALIFIERS = new Set(['Pro', 'Prime', 'Flash', 'Lite', 'Klein', 'Flare', 'Sunburst'])

/** Family name from a model title, without trailing version or variant words. */
export function modelFamily(title: string): string {
  const words = title.split(' ')

  while (words.length > 1) {
    const last = words.at(-1) ?? ''

    if (!MODEL_QUALIFIERS.has(last) && !/^\d+(\.\d+)*$/.test(last)) {
      break
    }

    words.pop()
  }

  return words.join(' ')
}
