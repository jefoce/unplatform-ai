#!/usr/bin/env bash
# Prints the ffmpeg sources GHCR tag from scripts/ffmpeg/versions.env.
set -euo pipefail

# shellcheck disable=SC1091
source scripts/ffmpeg/versions.env

echo "ffmpeg-$FFMPEG_VERSION-x264-${X264_COMMIT:0:8}-zlib-$ZLIB_VERSION"
