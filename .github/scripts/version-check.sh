#!/usr/bin/env bash
set -euo pipefail

# Dependabot pull requests into releases are never merged. They stay open as a
# reminder until the update lands on the next version branch.
MARKER='<!-- pr-version apply-on-next -->'
REMINDER='Not merged into releases. Apply these updates on the next version branch, then close this PR.'

if [[ "$PR_AUTHOR" == 'dependabot[bot]' && "$BASE_REF" == 'releases' ]]; then
  printf '%s\n' "$REMINDER"
  gh label create apply-on-next --description 'Apply on the next version branch' --color fbca04 --force >/dev/null
  gh pr edit "$PR_NUMBER" --repo "$GITHUB_REPOSITORY" --add-label apply-on-next >/dev/null
  comment_id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" --paginate \
    --jq ".[] | select(.body | contains(\"$MARKER\")) | .id")

  if [[ -n "$comment_id" ]]; then
    gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment_id" \
      -f body="$MARKER
$REMINDER" >/dev/null
  else
    gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$PR_NUMBER/comments" \
      -f body="$MARKER
$REMINDER" >/dev/null
  fi

  exit 0
fi

v_pkg=$(node -p "require('./package.json').version")
v_cargo=$(sed -n 's/^version = "\(.*\)"/\1/p' src-tauri/Cargo.toml | head -1)
v_lock=$(awk '/^\[\[package\]\]/ { in_package = 0 } /^name = "unplatform-ai"$/ { in_package = 1 } in_package && /^version = "/ { gsub(/^version = "|"$/, ""); print; exit }' src-tauri/Cargo.lock)
[[ "$v_pkg" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "::error::version '$v_pkg' is not X.Y.Z"; exit 1; }
[[ "$v_pkg" == "$v_cargo" && "$v_pkg" == "$v_lock" ]] || { echo "::error::versions differ: package $v_pkg, cargo $v_cargo, lock $v_lock"; exit 1; }
[[ "$TITLE" == "$v_pkg" ]] || { echo "::error::PR title must be '$v_pkg'"; exit 1; }
git rev-parse -q --verify "refs/tags/v$v_pkg" >/dev/null && { echo "::error::v$v_pkg already exists"; exit 1; }
last=$(git tag -l 'v*' | grep -v -- '-rc\.' | sed 's/^v//' | sort -V | tail -1)
if [[ -n "$last" ]]; then
  [[ "$(printf '%s\n%s\n' "$last" "$v_pkg" | sort -V | tail -1)" == "$v_pkg" && "$last" != "$v_pkg" ]] || { echo "::error::$v_pkg is not greater than $last"; exit 1; }
fi
grep -q "^## $v_pkg" CHANGELOG.md || { echo "::error::CHANGELOG.md has no '## $v_pkg' section"; exit 1; }
