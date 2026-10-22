#!/usr/bin/env bash
# Builds pinned small-ICU Node for macOS arm64 or Linux x64. Source is SHA-256 checked.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
source "$SCRIPT_DIR/versions.env"

TARGET=""
OUT=""

usage() {
  printf 'usage: %s [--target <triple>] [--out <dir>]\n' "$(basename "$0")"
}

fail() {
  printf '[node] error: %s\n' "$*" >&2
  exit 1
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

CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/unplatform-ai-build/node"
OUT=${OUT:-"$CACHE_ROOT/$NODE_VERSION-small-icu/$TARGET"}
WORK=${NODE_BUILD_WORK:-"$CACHE_ROOT/work/$NODE_VERSION-small-icu-$TARGET"}
SRC="$WORK/src"
SRC_DIR="$WORK/node-v$NODE_VERSION"
PREFIX="$WORK/prefix"
JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)

mkdir -p "$WORK" "$SRC" "$OUT"
DEST="$OUT/unplatform-ai-server-$TARGET"

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

printf '[node] build %s (%s)\n' "$NODE_VERSION" "$TARGET"
(
  cd "$SRC_DIR"
  help=$(./configure --help 2>&1)
  for flag in --with-intl --without-npm --without-corepack; do
    [[ "$help" == *"$flag"* ]] || fail "configure does not support $flag"
  done
  [[ "$help" == *"small-icu"* ]] || fail "configure does not support small-icu"
  if [[ "$(uname -s)" == Darwin ]]; then
    # common.gypi hardcodes 13.5, so the user flags must win.
    export MACOSX_DEPLOYMENT_TARGET=13.0
    export CFLAGS="-mmacosx-version-min=13.0 ${CFLAGS:-}"
    export CXXFLAGS="-mmacosx-version-min=13.0 ${CXXFLAGS:-}"
    export LDFLAGS="-mmacosx-version-min=13.0 ${LDFLAGS:-}"
  fi
  # Next 16 requires node:inspector at startup, so the custom Node keeps it.
  ./configure --prefix="$PREFIX" --with-intl=small-icu --without-npm \
    --without-corepack
  make -j"$JOBS"
)

BIN="$SRC_DIR/out/Release/node"
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

printf '[node] binary %s\n' "$DEST"
printf '[node] size %s\n' "$(du -h "$DEST" | cut -f1)"
