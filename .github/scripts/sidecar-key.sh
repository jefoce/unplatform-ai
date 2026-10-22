#!/usr/bin/env bash
# Prints <name>-<target>-<first16> where the hash covers every file under
# scripts/<name> (sorted path + sha256), the target triple, the runner image and the profile.
set -euo pipefail

name=${1:?name}
target=${2:?target}
runner=${3:?runner image}
profile=${4:-}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

sha256_stream() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  else
    shasum -a 256 | cut -d' ' -f1
  fi
}

hash=$(
  {
    while IFS= read -r file; do
      printf '%s\n' "${file#scripts/$name/}"
      sha256_file "$file"
    done < <(find "scripts/$name" -type f | LC_ALL=C sort)
    printf '%s\n' "$target" "$runner" "$profile"
  } | sha256_stream
)

echo "$name-$target-${hash:0:16}"
