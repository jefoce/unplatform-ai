#!/usr/bin/env bash
# Prints the sidecar binary name. The suffix defaults to .exe for Windows targets.
set -euo pipefail

name=${1:?name}
target=${2:?target}

if (( $# >= 3 )); then
  exe=$3
elif [[ "$target" == *windows* ]]; then
  exe='.exe'
else
  exe=''
fi

case "$name" in
  ffmpeg) echo "ffmpeg-$target$exe" ;;
  node) echo "unplatform-ai-server-$target$exe" ;;
  *) echo "::error::unsupported sidecar $name" >&2; exit 1 ;;
esac
