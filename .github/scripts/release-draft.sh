#!/usr/bin/env bash
# Recreates the draft release and prints its id for GITHUB_OUTPUT.
set -euo pipefail

tag=${TAG:?tag}
prerelease=${PRERELEASE:-false}

gh api --paginate "repos/$GITHUB_REPOSITORY/releases" \
  --jq ".[] | select(.draft and .tag_name == \"$tag\") | .id" |
  while IFS= read -r id; do
    gh api -X DELETE "repos/$GITHUB_REPOSITORY/releases/$id" >&2
  done

body="See CHANGELOG.md.

Source code offer: the installers bundle libvips and GStreamer under the LGPL. The exact versions and source links are in THIRD_PARTY_NOTICES.md. We offer the corresponding source on physical media or by download for three years after this release. Request it at https://github.com/jefoce/unplatform-ai/issues."
args=(-f tag_name="$tag" -f target_commitish="$GITHUB_SHA" -f name="$tag" -f body="$body" -F draft=true)
if [[ "$prerelease" == "true" ]]; then args+=(-F prerelease=true); fi
id=$(gh api -X POST "repos/$GITHUB_REPOSITORY/releases" "${args[@]}" --jq .id)
[[ -n "$id" ]] || { echo "::error::draft release id missing" >&2; exit 1; }
echo "id=$id"
