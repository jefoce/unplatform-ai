#!/usr/bin/env bash
# Prints the ffmpeg and Node runner images for a target, in that order.
set -euo pipefail

target=${1:?target}

case "$target" in
  aarch64-apple-darwin) echo 'macos-15 macos-15' ;;
  x86_64-unknown-linux-gnu) echo 'ubuntu-22.04 ubuntu-22.04' ;;
  x86_64-pc-windows-msvc) echo 'ubuntu-22.04 windows-latest' ;;
  *) echo "::error::unsupported target $target" >&2; exit 1 ;;
esac
