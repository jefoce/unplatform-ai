import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = fileURLToPath(new URL('../src/app/', import.meta.url))

/** Full-bleed lime tile with centered NH. */
const svg = ({
  fontSize,
  x,
  y,
}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="2048" height="2048">
  <rect width="2048" height="2048" rx="460" fill="#A8FF3E" />
  <text x="${x}" y="${y}" text-anchor="middle" fill="#0b0d0c"
    style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-weight:800;font-size:${fontSize}px;letter-spacing:-0.06em">NH</text>
</svg>`

// ponytail: text uses system sans like the desktop asset. Embed a font for byte-identical output across machines.
const master = (opts) =>
  sharp(Buffer.from(svg(opts)))
    .png()
    .toBuffer()

const jobs = [
  { name: 'icon.png', size: 512, fontSize: 1041, x: 993, y: 1399 },
  { name: 'apple-icon.png', size: 180, fontSize: 694, x: 1003, y: 1269 },
]

for (const { name, size, ...opts } of jobs) {
  const source = await master(opts)
  await sharp(source)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(OUT + name)
  console.log(`${name} ${size}x${size} font ${opts.fontSize}`)
}
