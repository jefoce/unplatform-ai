#!/usr/bin/env bash
# Fails when a macOS sidecar links outside /usr or /System, or targets another OS.
set -euo pipefail

for binary in "$@"; do
  [[ -f "$binary" ]] || { echo "::error::missing sidecar $binary" >&2; exit 1; }

  while read -r dependency; do
    case "$dependency" in
      /usr/lib/*|/System/Library/*) ;;
      *) echo "::error::$binary links $dependency" >&2; exit 1 ;;
    esac
  done < <(otool -L "$binary" | awk 'NR > 1 { print $1 }')

  archs=$(lipo -archs "$binary")
  if [[ "$archs" != "arm64" ]]; then
    echo "::error::$binary is $archs, expected arm64" >&2
    exit 1
  fi

  if ! vtool -show-build "$binary" | grep -q 'minos 13\.0'; then
    echo "::error::$binary does not target minos 13.0" >&2
    exit 1
  fi

  echo "[macos] $binary links only system libraries, minos 13.0, arm64"
done
