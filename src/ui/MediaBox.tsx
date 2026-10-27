import type { ReactNode } from 'react'

interface MediaBoxProps {
  aspect: string
  children: ReactNode
}

/** CSS ratio form of `16/9`, `16:9` or `16 / 9`. */
function ratioOf(aspect: string): string {
  return aspect.replace(':', '/')
}

function aspectValue(aspect: string): number {
  const [width, height] = ratioOf(aspect).split('/').map(Number)

  return (width ?? 0) / (height ?? 0)
}

/**
 * Box sized from a media aspect, so the stage backdrop shows around it.
 * Container units fit it to the stage in both directions.
 * @public
 */
export function MediaBox(props: MediaBoxProps) {
  const { aspect, children } = props

  const style = {
    aspectRatio: ratioOf(aspect),
    width: `min(100cqw, calc(100cqh * ${aspectValue(aspect)}))`,
    height: 'auto',
  }

  return (
    <div style={style} className="max-h-full max-w-full overflow-hidden rounded-xl">
      <div className="size-full">{children}</div>
    </div>
  )
}
