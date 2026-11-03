import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = fileURLToPath(new URL('../src/app/', import.meta.url))
const SOURCE = fileURLToPath(new URL('../app-icon.png', import.meta.url))

const jobs = [
  { name: 'icon.png', size: 512 },
  { name: 'apple-icon.png', size: 180 },
]

for (const { name, size } of jobs) {
  await sharp(SOURCE)
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(OUT + name)
  console.log(`${name} ${size}x${size}`)
}
