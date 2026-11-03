#!/usr/bin/env bash
# Release builds run only in the canonical repository, from 0.4.0 on, with ascending release subjects.
set -euo pipefail

version=${VERSION:?version}
repo=${GITHUB_REPOSITORY:?repository}

if [[ "$repo" != "jefoce/unplatform-ai" ]]; then
  echo "::error::release $version must run in jefoce/unplatform-ai, not $repo" >&2
  exit 1
fi

oldest=$(printf '%s\n0.4.0\n' "$version" | sort -V | head -1)
if [[ "$oldest" != "0.4.0" ]]; then
  echo "::error::release $version is older than 0.4.0 and is not built from this repository" >&2
  exit 1
fi

if [[ "${GITHUB_REF_NAME:-}" == "releases" ]]; then
  package_version=$(node -p "require('./package.json').version")
  previous=''
  newest=''
  while IFS= read -r subject; do
    if [[ ! "$subject" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "::error::release subject '$subject' is not a semver" >&2
      exit 1
    fi
    if [[ -n "$previous" ]]; then
      if [[ "$previous" == "$subject" ]] || [[ "$(printf '%s\n%s\n' "$previous" "$subject" | sort -V | head -1)" != "$previous" ]]; then
        echo "::error::release subjects are not strictly ascending: $previous then $subject" >&2
        exit 1
      fi
    fi
    previous=$subject
    newest=$subject
  done < <(git log --reverse --format=%s HEAD)
  if [[ "$newest" != "$package_version" ]]; then
    echo "::error::newest release subject $newest is not package version $package_version" >&2
    exit 1
  fi
fi
