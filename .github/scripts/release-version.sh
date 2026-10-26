#!/usr/bin/env bash
# Prints the GITHUB_OUTPUT lines for the release version job.
set -euo pipefail

version=$(node -p "require('./package.json').version")
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::version '$version' is not X.Y.Z" >&2; exit 1; }

if [[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]]; then
  tag=${TAG_INPUT:-}
  [[ -n "$tag" ]] || { echo "::error::tag input is required" >&2; exit 1; }
  [[ "$tag" == "v$version-rc."* ]] || { echo "::error::$tag does not match version $version" >&2; exit 1; }
  prerelease=true
elif [[ "${GITHUB_REF_TYPE:-}" == tag ]]; then
  tag=${GITHUB_REF_NAME:-}
  [[ "$tag" == "v$version-rc."* ]] || { echo "::error::$tag does not match version $version" >&2; exit 1; }
  prerelease=true
else
  tag="v$version"
  subject=$(git log -1 --format=%s)
  [[ "$subject" == "$version" ]] || { echo "::error::commit title '$subject' is not '$version'" >&2; exit 1; }
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    echo "::error::$tag already exists. Bump the version in the PR." >&2
    exit 1
  fi
  prerelease=false
fi

printf 'version=%s\ntag=%s\nprerelease=%s\n' "$version" "$tag" "$prerelease"
