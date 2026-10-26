#!/usr/bin/env bash
# Builds one per-target checksum file, or merges all of them plus the ffmpeg sources.
set -euo pipefail

mode=${1:?mode}

if [[ "$mode" == build ]]; then
  target=${2:?target}
  dist=${3:?dist}
  out="sha256-$target.txt"
  (
    cd "$dist"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -- *
    else
      shasum -a 256 -- *
    fi
  ) > "$out"
  cat "$out"
elif [[ "$mode" == merge ]]; then
  dist=${2:?dist}
  sources=${3:?sources}
  archive=$(find "$sources" -maxdepth 1 -type f -name '*.tar.*' -print -quit)
  [[ -n "$archive" ]] || { echo "::error::no ffmpeg source archives found" >&2; exit 1; }
  workspace=$(pwd)
  sort "$dist"/*.txt > SHA256SUMS.txt
  (cd "$sources" && shasum -a 256 -- *.tar.*) >> "$workspace/SHA256SUMS.txt"
  sort -o SHA256SUMS.txt SHA256SUMS.txt
  cat SHA256SUMS.txt
else
  echo "usage: checksums.sh build <target> <dist> | merge <dist> <sources>" >&2
  exit 2
fi
