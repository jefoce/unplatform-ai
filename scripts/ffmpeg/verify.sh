#!/usr/bin/env bash
# Checks a built ffmpeg for license flags, required features and app commands.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES="$SCRIPT_DIR/../../tests/fixtures/media"

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
      linux-vdso|libc|libm|libpthread|libdl|librt|ld-linux*) ;;
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
      /usr/lib/libSystem.B.dylib|/usr/lib/libz.1.dylib|/usr/lib/libiconv.2.dylib|/System/Library/Frameworks/*) ;;
      *) fail "unexpected linked library: $path" ;;
    esac
  done <<< "$list"
  pass "linked libraries"
}

check_linked_libraries() {
  case "$(uname -s)" in
    Darwin) link_otool ;;
    Linux) link_ldd ;;
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

BIN=${1:-${FFMPEG_BINARY:-}}
[[ -n "$BIN" ]] || fail "usage: verify.sh <ffmpeg-binary> (or set FFMPEG_BINARY)"
[[ -f "$BIN" ]] || fail "binary not found: $BIN"
[[ -x "$BIN" ]] || fail "binary not executable: $BIN"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
  *) IS_WINDOWS=0 ;;
esac
case "$BIN" in
  *.exe|*.EXE)
    if ((IS_WINDOWS == 0)); then
      printf '[verify] SKIPPED (not verified): cannot run a Windows .exe on %s\n' "$(uname -s)"
      exit 0
    fi
    ;;
esac

has_name() {
  local list=$1 name=$2
  printf '%s\n' "$list" | awk -v want="$name" '$2 == want { found = 1 } END { exit !found }'
}

require_names() {
  local label=$1 list=$2
  shift 2
  local name
  for name in "$@"; do
    has_name "$list" "$name" || fail "$label missing: $name"
  done
  pass "$label"
}

BUILDCONF=$("$BIN" -hide_banner -buildconf 2>&1)
grep -q -- '--enable-nonfree' <<< "$BUILDCONF" && fail "nonfree build"
grep -q -- '--enable-gpl' <<< "$BUILDCONF" || fail "GPL build flag missing"
grep -q -- '--enable-libx264' <<< "$BUILDCONF" || fail "libx264 build flag missing"
if grep -Eq '/Users/|/home/' <<< "$BUILDCONF"; then
  fail "buildconf contains a home path"
fi
pass "license flags"

check_linked_libraries
if [[ "$(uname -s)" == Darwin ]]; then
  check_minos
fi

ENCODERS=$("$BIN" -hide_banner -encoders 2>&1)
require_names encoders "$ENCODERS" libx264 aac png mjpeg

DECODERS=$("$BIN" -hide_banner -decoders 2>&1)
require_names decoders "$DECODERS" h264 hevc av1 vp8 vp9 prores dnxhd mpeg4 aac alac mp3 ac3 eac3 opus vorbis png mjpeg webp pcm_u8 pcm_s32le pcm_f64le

FILTERS=$("$BIN" -hide_banner -filters 2>&1)
require_names filters "$FILTERS" scale testsrc2 sine color drawbox overlay transpose

[[ -d "$FIXTURES" ]] || fail "fixtures not found: $FIXTURES"
TMP=$(mktemp -d 2>/dev/null || true)
if [[ -z "$TMP" ]]; then
  # Fallback for restricted temp dirs.
  mkdir -p "$HOME/.cache/unplatform-ai-build/tmp"
  TMP=$(mktemp -d "$HOME/.cache/unplatform-ai-build/tmp/verify.XXXXXX")
fi
trap 'rm -rf "$TMP"' EXIT

run() {
  "$BIN" -hide_banner -loglevel error "$@" || fail "command failed: $*"
}

nonempty() {
  [[ -s "$1" ]] || fail "empty output: $1"
}

# One case per accepted container: probe, frame and compat.
for source in sample.mp4 sample.mov sample.webm; do
  probe=$("$BIN" -hide_banner -i "$FIXTURES/$source" 2>&1 || true)
  grep -q 'Duration:' <<< "$probe" || fail "probe found no duration for $source"
  grep -Eq '[0-9]+x[0-9]+' <<< "$probe" || fail "probe found no dimensions for $source"

  run -ss 0.5 -i "$FIXTURES/$source" -frames:v 1 -vf scale=320:-2 -y "$TMP/$source.frame.png"
  nonempty "$TMP/$source.frame.png"

  run -i "$FIXTURES/$source" -c:v libx264 -pix_fmt yuv420p -c:a aac \
    -movflags +faststart -y "$TMP/$source.compat.mp4"
  nonempty "$TMP/$source.compat.mp4"
done

# Audio inputs convert to the webview-safe m4a.
for source in sample.mp3 sample.wav sample.m4a sample.aac sample.ogg sample.opus; do
  probe=$("$BIN" -hide_banner -i "$FIXTURES/$source" 2>&1 || true)
  grep -q 'Audio:' <<< "$probe" || fail "probe found no audio stream for $source"

  run -i "$FIXTURES/$source" -vn -c:a aac -y "$TMP/$source.compat.m4a"
  nonempty "$TMP/$source.compat.m4a"
done

# Image inputs go through sharp in the app. ffmpeg still decodes them for frames.
for source in sample.jpg sample.png sample.webp; do
  probe=$("$BIN" -hide_banner -i "$FIXTURES/$source" 2>&1 || true)
  grep -Eq '[0-9]+x[0-9]+' <<< "$probe" || fail "probe found no dimensions for $source"

  run -i "$FIXTURES/$source" -frames:v 1 -y "$TMP/$source.frame.png"
  nonempty "$TMP/$source.frame.png"
done

run -sseof -1 -i "$FIXTURES/sample.mp4" -update 1 -q:v 1 -y "$TMP/last.jpg"
nonempty "$TMP/last.jpg"

run -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=440 \
  -t 2 -shortest -pix_fmt yuv420p -y "$TMP/mock.mp4"
nonempty "$TMP/mock.mp4"
pass "app commands"

printf '[verify] PASS %s\n' "$BIN"
