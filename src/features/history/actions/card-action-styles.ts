export const ROUND_BUTTON_CLASSES =
  'inline-flex h-8 w-8 items-center justify-center rounded-full @min-[240px]:size-9 @min-[486px]:size-8 border border-white/10 bg-black/50 text-white backdrop-blur linux:bg-solid-overlay transition-colors hover:bg-black/70'

export const COMPACT_ROUND_BUTTON_CLASSES =
  'inline-flex size-6 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur linux:bg-solid-overlay transition-colors hover:bg-black/70'

export const HOVER_REVEAL_CLASSES =
  'pointer-events-none opacity-0 transition-opacity group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100 group-has-[[data-card-menu][data-state=open]]/card:pointer-events-auto group-has-[[data-card-menu][data-state=open]]/card:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100'

export const ACTIVE_BUTTON_CLASSES =
  'bg-linear-[180deg] from-favorite/[0.22] to-favorite/[0.08] text-favorite linux:bg-black/60'
