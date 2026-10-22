#!/usr/bin/env bash
# Uploads assets to a draft release by id, deleting same-name assets first.
set -euo pipefail

id=${1:?release id}
shift

for file in "$@"; do
  name=$(basename "$file")

  if [[ ! "$name" =~ ^[A-Za-z0-9._-]+$ ]]; then
    printf '[release] error: asset name needs URL encoding: %s\n' "$name" >&2
    exit 1
  fi

  assets=$(gh api "repos/$GITHUB_REPOSITORY/releases/$id/assets" --paginate \
    --jq ".[] | select(.name == \"$name\") | .id")

  while IFS= read -r asset; do
    if [[ -n "$asset" ]]; then
      gh api -X DELETE "repos/$GITHUB_REPOSITORY/releases/assets/$asset"
    fi
  done <<< "$assets"

  gh api -X POST \
    -H "Content-Type: application/octet-stream" \
    "https://uploads.github.com/repos/$GITHUB_REPOSITORY/releases/$id/assets?name=$name" \
    --input "$file" \
    --jq .name
done
