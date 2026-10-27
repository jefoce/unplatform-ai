#!/usr/bin/env bash
# Pulls an ORAS artifact, flattens it, and prints true when every required file exists, false otherwise. Diagnostics go to stderr.
set -euo pipefail

ref=${1:?ref}
dir=${2:?dir}
shift 2

if ! oras pull "$ref" -o "$dir" >&2; then
  echo false
  exit 0
fi

find "$dir" -mindepth 2 -type f -exec mv -n {} "$dir/" \;
find "$dir" -mindepth 1 -type d -empty -delete

for required in "$@"; do
  if ! compgen -G "$dir/$required" >/dev/null; then
    echo "GHCR tag incomplete, rebuilding" >&2
    echo false
    exit 0
  fi
done

echo true
