import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import sharp from 'sharp'

const run = promisify(execFile)
const SOURCE = fileURLToPath(new URL('../app-icon.png', import.meta.url))
const ICNS = fileURLToPath(new URL('../src-tauri/icons/icon.icns', import.meta.url))
const SPLASH = fileURLToPath(new URL('../src-tauri/splash/app-icon.png', import.meta.url))

// macOS wants the artwork in an 832 px box with 96 px transparent padding at 1024.
const ARTWORK = 832
const PADDING = 96

const SIZES = [
  ['icon_16x16.png', 16],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

/** Scales the artwork and its padding proportionally for a square icon. */
async function buildIcon(size) {
  const art = Math.round((size * ARTWORK) / 1024)
  const pad = size - art
  const left = Math.floor(pad / 2)
  const top = Math.floor(pad / 2)

  return sharp(SOURCE)
    .resize(art, art, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top,
      bottom: pad - top,
      left,
      right: pad - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()
}

const dir = await mkdtemp(join(tmpdir(), 'unplatform-ai-icon-'))
const iconset = join(dir, 'icon.iconset')

try {
  await run('mkdir', ['-p', iconset])

  for (const [name, size] of SIZES) {
    const icon = await buildIcon(size)
    await writeFile(join(iconset, name), icon)
  }

  await run('iconutil', ['-c', 'icns', iconset, '-o', ICNS])
  console.log(`icon.icns ${ARTWORK}+${PADDING * 2} box`)
} finally {
  await rm(dir, { recursive: true, force: true })
}

await sharp(SOURCE).resize(256, 256, { kernel: 'lanczos3' }).png().toFile(SPLASH)
console.log('splash/app-icon.png 256x256')
