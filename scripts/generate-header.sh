#!/usr/bin/env bash
# Run from the repo root: bash make-header.sh app-icon.png
set -euo pipefail

icon=${1:-app-icon.png}
out=${2:-docs}
mkdir -p "$out"

if base64 --help 2>&1 | grep -q -- '-w'; then
  data=$(base64 -w0 "$icon")
else
  data=$(base64 -i "$icon" | tr -d '\n')
fi

write() {
  local file=$1 color=$2
  cat > "$file" <<SVG
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="360" height="56" viewBox="0 0 360 56" role="img" aria-label="Unplatform AI">
  <image x="0" y="4" width="48" height="48" xlink:href="data:image/png;base64,$data" href="data:image/png;base64,$data"/>
  <text x="56" y="28" dominant-baseline="central" fill="$color" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif" font-size="32" font-weight="600">Unplatform AI</text>
</svg>
SVG
}

