import { GLOW_CLASSES, type Tone } from './status-tone'

interface GlowLayersProps {
  tone: Tone
}

/** Three stacked glow layers, only the active tone visible. */
export function GlowLayers(props: GlowLayersProps) {
  const { tone } = props

  return (
    <>
      {(['lime', 'gray', 'red'] as const).map((name) => (
        <div
          key={name}
          aria-hidden
          className={`${GLOW_CLASSES[name]} pointer-events-none absolute inset-0 transition-opacity duration-600`}
          style={{ opacity: tone === name ? 1 : 0 }}
        />
      ))}
    </>
  )
}
