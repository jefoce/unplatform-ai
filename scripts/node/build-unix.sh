#!/usr/bin/env bash
# Builds pinned small-ICU Node for macOS arm64 or Linux x64. Source is SHA-256 checked.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/node/versions.env
source "$SCRIPT_DIR/versions.env"
# shellcheck source=scripts/build-work.sh
source "$SCRIPT_DIR/../build-work.sh"

TARGET=""
OUT=""
KEEP_WORK=0

usage() {
  printf 'usage: %s [--target <triple>] [--out <dir>] [--keep-work]\n' "$(basename "$0")"
}

fail() {
  printf '[node] error: %s\n' "$*" >&2
  exit 1
}

stamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

phase_start() {
  PHASE_START=$(date +%s)
  printf '[node] %s start %s\n' "$1" "$(stamp)"
}

phase_end() {
  printf '[node] %s done %s (%ss)\n' "$1" "$(stamp)" "$(($(date +%s) - PHASE_START))"
}

host_triple() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) echo aarch64-apple-darwin ;;
    Linux-x86_64) echo x86_64-unknown-linux-gnu ;;
    *) fail "unsupported host: $(uname -s)-$(uname -m)" ;;
  esac
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

download_verify() {
  local expected=$1 dest=$2 url
  if [[ -f "$dest" && "$(sha256_of "$dest")" == "$expected" ]]; then
    printf '[node] cached %s\n' "$(basename "$dest")"
    return 0
  fi

  rm -f "$dest" "$dest.part"
  url="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION.tar.xz"
  printf '[node] download %s\n' "$url"
  curl -fL --retry 3 --connect-timeout 20 -o "$dest.part" "$url" \
    || fail "download failed: $url"
  local actual
  actual=$(sha256_of "$dest.part")
  if [[ "$actual" != "$expected" ]]; then
    rm -f "$dest.part"
    fail "sha256 mismatch for $url: expected $expected, got $actual"
  fi
  mv "$dest.part" "$dest"
}

copy_license() {
  local dest="$SCRIPT_DIR/../../licenses/LICENSE.node"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$SRC_DIR/LICENSE" ]]; then
    cp "$SRC_DIR/LICENSE" "$dest"
  else
    tar -xJf "$SRC/node-v$NODE_VERSION.tar.xz" -O "node-v$NODE_VERSION/LICENSE" > "$dest"
  fi
}

while (($#)); do
  case "$1" in
    --target) TARGET=${2:?missing value for --target}; shift 2 ;;
    --out) OUT=${2:?missing value for --out}; shift 2 ;;
    --keep-work) KEEP_WORK=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

TARGET=${TARGET:-$(host_triple)}
case "$TARGET" in
  aarch64-apple-darwin)
    [[ "$(uname -s)-$(uname -m)" == Darwin-arm64 ]] || fail "$TARGET must be built on macOS arm64"
    ;;
  x86_64-unknown-linux-gnu)
    [[ "$(uname -s)-$(uname -m)" == Linux-x86_64 ]] || fail "$TARGET must be built on Linux x64"
    ;;
  *) fail "unsupported target: $TARGET" ;;
esac

for tool in curl tar make cc c++ python3 strip; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing tool: $tool"
done

SUFFIX=${NODE_OUTPUT_SUFFIX:-}
EXTRA=${NODE_CONFIGURE_EXTRA:-}
VARIANT="$NODE_VERSION-small-icu$SUFFIX"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/unplatform-ai-build/node"
OUT=${OUT:-"$CACHE_ROOT/$VARIANT/$TARGET"}
# Local builds need 25 GiB of work tree, measured on macOS arm64.
resolve_work node node "$VARIANT" \
  "${NODE_BUILD_WORK:-$CACHE_ROOT/work/$VARIANT-$TARGET}" 26214400
SRC="$CACHE_ROOT/src"
SRC_DIR="$WORK/node-v$NODE_VERSION"
LINK_START="$WORK/link-start"
PREFIX="$WORK/prefix"
build_jobs node "${NODE_BUILD_JOBS:-}" NODE_BUILD_JOBS

mkdir -p "$WORK" "$SRC" "$OUT"

# The archive used to live inside the work tree. Move a cached copy out.
LEGACY_ARCHIVE="$CACHE_ROOT/work/$VARIANT-$TARGET/src/node-v$NODE_VERSION.tar.xz"
if [[ ! -f "$SRC/node-v$NODE_VERSION.tar.xz" && -f "$LEGACY_ARCHIVE" ]]; then
  mv "$LEGACY_ARCHIVE" "$SRC/"
fi
DEST="$OUT/unplatform-ai-server-$TARGET$SUFFIX"

download_verify "$NODE_SHA256" "$SRC/node-v$NODE_VERSION.tar.xz"

if [[ -f "$DEST" ]]; then
  bash "$SCRIPT_DIR/verify.sh" "$DEST"
  copy_license
  printf '[node] cached binary %s\n' "$DEST"
  exit 0
fi

rm -rf "$SRC_DIR" "$PREFIX"
mkdir -p "$PREFIX"
tar -xJf "$SRC/node-v$NODE_VERSION.tar.xz" -C "$WORK"
BIN="$(cd "$SRC_DIR" && pwd)/out/Release/node"

printf '[node] build %s (%s)\n' "$NODE_VERSION" "$TARGET"
(
  cd "$SRC_DIR"
  help=$(./configure --help 2>&1)
  for flag in --with-intl --without-npm --without-corepack --without-amaro; do
    [[ "$help" == *"$flag"* ]] || fail "configure does not support $flag"
  done
  [[ "$help" == *"small-icu"* ]] || fail "configure does not support small-icu"
  extra_flags=()
  if [[ -n "$EXTRA" ]]; then
    read -r -a extra_flags <<< "$EXTRA"
    for flag in ${extra_flags[@]+"${extra_flags[@]}"}; do
      [[ "$flag" == --* ]] || fail "NODE_CONFIGURE_EXTRA token must start with --: $flag"
      [[ "$help" == *"$flag"* ]] || fail "unknown configure flag: $flag"
    done
  fi
  if [[ "$(uname -s)" == Darwin ]]; then
    # common.gypi hardcodes 13.5, so the user flags must win.
    export MACOSX_DEPLOYMENT_TARGET=13.0
    export CFLAGS="-Os -mmacosx-version-min=13.0 ${CFLAGS:-}"
    export CXXFLAGS="-Os -mmacosx-version-min=13.0 ${CXXFLAGS:-}"
    export LDFLAGS="-mmacosx-version-min=13.0 ${LDFLAGS:-}"
  else
    export CFLAGS="-Os ${CFLAGS:-}"
    export CXXFLAGS="-Os ${CXXFLAGS:-}"
  fi
  # Amaro is unused by Next: 53,493,448 bytes, 51.0 MiB. Not --v8-lite-mode (+21.5% latency).
  # Not --without-sqlite (link failure) or --without-inspector (Next 16 loads node:inspector).
  phase_start configure
  ./configure --prefix="$PREFIX" --with-intl=small-icu --without-npm \
    --without-corepack --without-amaro --enable-lto ${extra_flags[@]+"${extra_flags[@]}"}
  phase_end configure

  # Only node ships. cctest and embedtest also link under LTO and blew the CI timeout.
  rm -f "$LINK_START"
  phase_start compile
  make -C out BUILDTYPE=Release -j"$JOBS" node 2>&1 | while IFS= read -r line; do
    if [[ "$line" == *"LINK(target) $BIN" ]]; then
      now=$(date +%s)
      printf '[node] compile done %s (%ss)\n' "$(stamp)" "$((now - PHASE_START))"
      printf '[node] link start %s\n' "$(stamp)"
      printf '%s' "$now" > "$LINK_START"
    fi

    printf '%s\n' "$line"
  done

  [[ -s "$LINK_START" ]] || fail "link of node did not start"
  printf '[node] link done %s (%ss)\n' "$(stamp)" "$(($(date +%s) - $(<"$LINK_START")))"
)

[[ -f "$BIN" ]] || fail "node build produced no binary"
if [[ "$(uname -s)" == Darwin ]]; then
  strip -x "$BIN"
else
  strip --strip-all "$BIN"
fi

cp "$BIN" "$DEST"
chmod +x "$DEST"
bash "$SCRIPT_DIR/verify.sh" "$DEST"
copy_license
cleanup_work node "$WORK" "$KEEP_WORK"

printf '[node] binary %s\n' "$DEST"
printf '[node] size %s\n' "$(du -h "$DEST" | cut -f1)"
