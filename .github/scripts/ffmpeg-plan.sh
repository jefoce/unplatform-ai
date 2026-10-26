#!/usr/bin/env bash
# Decides whether the ffmpeg job builds and where. Reads RESTORE_FOUND, SOURCES_FOUND
# and TARGET; appends build and out to GITHUB_OUTPUT. Sources matter on Linux only.
set -euo pipefail

restore_found=${RESTORE_FOUND:-false}
sources_found=${SOURCES_FOUND:-false}
target=${TARGET:?TARGET}

build=false
out=ffmpeg-out

if [[ "$restore_found" != "true" ]]; then
  build=true
elif [[ "$target" == *linux* && "$sources_found" != "true" ]]; then
  build=true
  out=ffmpeg-rebuild
fi

{
  echo "build=$build"
  echo "out=$out"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT}"
