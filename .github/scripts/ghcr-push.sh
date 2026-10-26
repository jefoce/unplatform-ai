#!/usr/bin/env bash
# Pushes files to an ORAS tag unless it already exists and the push is not forced.
set -euo pipefail

ref=${1:?ref}
dir=${2:?dir}
shift 2

if [[ "${FORCE:-}" != "true" ]] && oras manifest fetch "$ref" >/dev/null 2>&1; then
  echo "GHCR already has $ref"
  exit 0
fi

(
  cd "$dir"
  oras push --annotation "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY" "$ref" -- "$@"
)
echo "pushed $ref"
