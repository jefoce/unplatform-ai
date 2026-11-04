import type { ReactNode } from 'react'

interface MediaBoxProps {
  aspect: number
  children: ReactNode
}

/**
 * Box sized from a media aspect, so the stage backdrop shows around it.
 * Container units fit it to the stage in both directions.
 * @public
 */
export function MediaBox(props: MediaBoxProps) {
  const { aspect, children } = props

  const style = {
    aspectRatio: aspect,
    width: `min(100cqw, calc(100cqh * ${aspect}))`,
    height: 'auto',
  }

  return (
    <div style={style} className="max-h-full max-w-full overflow-hidden rounded-xl">
      <div className="relative size-full">{children}</div>
    </div>
  )
}
