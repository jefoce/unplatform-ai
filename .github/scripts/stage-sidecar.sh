#!/usr/bin/env bash
# Extracts a sidecar artifact, restores its exec bit, verifies it, and exports <NAME>_BINARY.
set -euo pipefail

name=${1:?name}
target=${2:?target}
artifact_dir=${3:?artifact dir}
out_dir=${4:?out dir}

if [[ -n "${REUSE_RUN:-}" ]]; then
  echo "sidecars from run $REUSE_RUN (workflow input)"
elif [[ -n "${VARIABLE_RUN:-}" ]]; then
  echo "sidecars from run $VARIABLE_RUN (repository variable)"
else
  echo "sidecars built in this run"
fi

binary=$(bash .github/scripts/sidecar-binary.sh "$name" "$target" "${EXE:-}")
upper=$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')
mkdir -p "$out_dir"

artifact_tar="$artifact_dir/$name-$target.tar.gz"
out_tar="$out_dir/$name-$target.tar.gz"

if [[ -f "$artifact_tar" && "$artifact_dir" != "$out_dir" ]]; then
  tar -xzf "$artifact_tar" -C "$out_dir"
elif [[ -f "$out_tar" ]]; then
  tar -xzf "$out_tar" -C "$out_dir"
  rm "$out_tar"
fi

if [[ "$target" != *windows* ]]; then
  chmod +x "$out_dir/$binary"
fi

bash "scripts/$name/verify.sh" "$out_dir/$binary"

printf '%s_BINARY=%s/%s/%s\n' "$upper" "${GITHUB_WORKSPACE:-$PWD}" "$out_dir" "$binary" >> "${GITHUB_ENV:?GITHUB_ENV}"
