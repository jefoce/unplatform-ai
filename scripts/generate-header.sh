#!/usr/bin/env bash
# Builds docs/images/header-light.svg and header-dark.svg with the app icon embedded once,
# resized for the 48 px slot. Run from the repo root: bash scripts/generate-header.sh
set -euo pipefail

icon=${1:-app-icon.png}
out=${2:-docs/images}
size=96

if [ ! -f "$icon" ]; then
  echo "missing icon: $icon" >&2
  exit 1
fi

mkdir -p "$out"

data=$(node --input-type=module - "$icon" "$size" <<'JS'
import sharp from 'sharp'

const [source, side] = process.argv.slice(2)
const png = await sharp(source)
  .resize(Number(side), Number(side), { kernel: 'lanczos3' })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer()

process.stdout.write(png.toString('base64'))
JS
)

if [ -z "$data" ]; then
  echo "failed to encode $icon" >&2
  exit 1
fi

write() {
  local file=$1 color=$2
  cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="56" viewBox="0 0 360 56" role="img" aria-label="Unplatform AI">
  <image x="0" y="4" width="48" height="48" href="data:image/png;base64,$data"/>
  <text x="56" y="28" dominant-baseline="central" fill="$color" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif" font-size="32" font-weight="600">Unplatform AI</text>
</svg>
SVG

  local embeds bytes
  embeds=$(grep -o 'data:image/png;base64' "$file" | wc -l | tr -d ' ')
  bytes=$(wc -c < "$file" | tr -d ' ')

  if [ "$embeds" -ne 1 ] || grep -q 'xlink:href' "$file" || [ "$bytes" -gt 20000 ]; then
    echo "expected one small href embed in $file" >&2
    exit 1
  fi
}

write "$out/header-light.svg" '#1f2328'
write "$out/header-dark.svg" '#f0f6fc'
echo "wrote $out/header-light.svg $out/header-dark.svg"
