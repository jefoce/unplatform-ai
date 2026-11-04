export const PRESET_ICONS = ['sparkles', 'audio-lines'] as const

export type PresetIcon = (typeof PRESET_ICONS)[number]
