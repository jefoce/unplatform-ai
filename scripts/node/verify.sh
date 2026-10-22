#!/usr/bin/env bash
# Checks a built small-ICU Node sidecar: version, ICU, linked libraries, smoke.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
source "$SCRIPT_DIR/versions.env"

SMOKE=0
if [[ "${1:-}" == "--smoke" ]]; then
  SMOKE=1
  shift
fi

fail() {
  printf '[verify] FAIL: %s\n' "$*" >&2
  exit 1
}

pass() {
  printf '[verify] ok: %s\n' "$*"
}

# Shared libraries must resolve to the OS, never homebrew, /usr/local or the build prefix.
link_ldd() {
  command -v ldd >/dev/null 2>&1 || fail "ldd not found, cannot check linked libraries"
  local list line name path checked=0
  list=$(ldd "$BIN" 2>&1 || true)
  if grep -Eqi 'not a dynamic executable|statically linked' <<< "$list"; then
    printf '[verify] linked libraries: static\n'
    pass "linked libraries"
    return
  fi
  printf '[verify] linked libraries\n'
  printf '%s\n' "$list" | sed '/^[[:space:]]*$/d; s/^[[:space:]]*/  /'
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" ]] && continue
    checked=1
    name=$(basename "${line%% *}")
    case "${name%%.so*}" in
      linux-vdso|libc|libm|libpthread|libdl|librt|libstdc++|libgcc_s|libatomic|libresolv|libutil|ld-linux*) ;;
      *) fail "unexpected linked library: $line" ;;
    esac
    path=${line##*=> }
    if [[ "$path" != "$line" ]]; then
      path=${path%% *}
      case "$path" in
        /lib/*|/lib64/*|/usr/lib/*|/usr/lib64/*) ;;
        *) fail "library outside system dirs: $path" ;;
      esac
    fi
  done <<< "$list"
  ((checked == 1)) || fail "could not parse ldd output"
  pass "linked libraries"
}

link_otool() {
  command -v otool >/dev/null 2>&1 || fail "otool not found, cannot check linked libraries"
  local list line path
  list=$(otool -L "$BIN" 2>&1) || fail "otool failed: $list"
  list=$(printf '%s\n' "$list" | tail -n +2)
  printf '[verify] linked libraries\n'
  printf '%s\n' "$list" | sed '/^[[:space:]]*$/d; s/^[[:space:]]*/  /'
  while IFS= read -r line; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" ]] && continue
    path=${line%% *}
    case "$path" in
      /usr/lib/*|/System/Library/Frameworks/*) ;;
      *) fail "unexpected linked library: $path" ;;
    esac
  done <<< "$list"
  pass "linked libraries"
}

check_linked_libraries() {
  case "$(uname -s)" in
    Darwin) link_otool ;;
    Linux) link_ldd ;;
    MINGW*|MSYS*|CYGWIN*) printf '[verify] linked libraries: skipped on Windows\n' ;;
    *) fail "unsupported platform: $(uname -s)" ;;
  esac
}

# The deployment target must stay at 13.0 or lower.
check_minos() {
  command -v otool >/dev/null 2>&1 || fail "otool not found, cannot check minos"
  local load minos
  load=$(otool -l "$BIN" 2>&1) || fail "otool failed: $load"
  grep -q LC_BUILD_VERSION <<< "$load" || fail "no LC_BUILD_VERSION in $BIN"
  minos=$(awk 'seen && $1 == "minos" { print $2; exit } /LC_BUILD_VERSION/ { seen = 1 }' <<< "$load")
  [[ -n "$minos" ]] || fail "could not read minos from LC_BUILD_VERSION"
  printf '[verify] minos %s\n' "$minos"
  awk -v m="$minos" 'BEGIN { split(m, v, "."); exit (v[1] * 100 + v[2] > 1300) }' \
    || fail "minos $minos is greater than 13.0"
  pass "minos $minos"
}

BIN=${1:-${NODE_BINARY:-}}
[[ -n "$BIN" ]] || fail "usage: verify.sh [--smoke] <node-binary> (or set NODE_BINARY)"
[[ -f "$BIN" ]] || fail "binary not found: $BIN"
[[ -x "$BIN" ]] || fail "binary not executable: $BIN"

VERSION=$("$BIN" -p 'process.version' 2>&1) || fail "binary did not run: $VERSION"
[[ "$VERSION" == "v$NODE_VERSION" ]] || fail "version is $VERSION, expected v$NODE_VERSION"
pass "version $VERSION"

ICU_SMALL=$("$BIN" -p 'process.config.variables.icu_small' 2>&1) \
  || fail "could not read icu_small: $ICU_SMALL"
[[ "$ICU_SMALL" == "true" ]] || fail "icu_small is $ICU_SMALL, expected true"
pass "small-icu"

MONTH=$("$BIN" -p "new Intl.DateTimeFormat('en-US', { month: 'long' }).format(0)" 2>&1) \
  || fail "Intl.DateTimeFormat failed: $MONTH"
[[ "$MONTH" == "January" ]] || fail "Intl.DateTimeFormat returned '$MONTH', expected January"
pass "Intl.DateTimeFormat $MONTH"

check_linked_libraries
if [[ "$(uname -s)" == Darwin ]]; then
  check_minos
fi

printf '[verify] smoke: NODE_BINARY=%q pnpm desktop:prepare && pnpm smoke\n' "$BIN"
printf '[verify] PASS %s\n' "$BIN"

if ((SMOKE)); then
  cd "$SCRIPT_DIR/../.."
  NODE_BINARY="$BIN" pnpm desktop:prepare
  NODE_BINARY="$BIN" pnpm smoke
fi
