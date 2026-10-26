'use client'

import { Play } from 'lucide-react'
import type { MouseEvent } from 'react'

const CENTER_PLAY_CLASSES =
  'absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70'

interface LazyVideoPlayButtonProps {
  label: string
  onPlay: (event: MouseEvent<HTMLButtonElement>) => void
}

/** Round play badge over the poster or the paused video. */
export function LazyVideoPlayButton(props: LazyVideoPlayButtonProps) {
  const { label } = props

  return (
    <button type="button" aria-label={label} onClick={props.onPlay} className={CENTER_PLAY_CLASSES}>
      <Play size={18} className="fill-current" aria-hidden />
    </button>
  )
}
