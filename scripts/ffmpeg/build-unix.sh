#!/usr/bin/env bash
# Builds pinned GPL ffmpeg for macOS or Linux. Sources are SHA-256 checked.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/ffmpeg/versions.env
source "$SCRIPT_DIR/versions.env"

PROFILE=minimal
TARGET=""
OUT=""
SOURCES=""

usage() {
  printf 'usage: %s [--target <triple>] [--out <dir>] [--sources <dir>] [--profile full|minimal]\n' "$(basename "$0")"
}

fail() {
  printf '[ffmpeg] error: %s\n' "$*" >&2
  exit 1
}

host_triple() {
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) echo aarch64-apple-darwin ;;
    Darwin-x86_64) echo x86_64-apple-darwin ;;
    Linux-x86_64) echo x86_64-unknown-linux-gnu ;;
    Linux-aarch64|Linux-arm64) echo aarch64-unknown-linux-gnu ;;
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
  local expected=$1 dest=$2
  shift 2
  local urls=("$@") index url next actual
  if [[ -f "$dest" && "$(sha256_of "$dest")" == "$expected" ]]; then
    printf '[ffmpeg] cached %s\n' "$(basename "$dest")"
    return 0
  fi

  rm -f "$dest" "$dest.part"
  for index in "${!urls[@]}"; do
    url=${urls[$index]}
    next=""
    if ((index + 1 < ${#urls[@]})); then
      next=${urls[$((index + 1))]}
    fi
    printf '[ffmpeg] download %s\n' "$url"
    if ! curl -fL --retry 3 --connect-timeout 20 -o "$dest.part" "$url" 2>/dev/null; then
      rm -f "$dest.part"
      [[ -n "$next" ]] || fail "no source matched sha256 for $(basename "$dest"): $expected"
      printf '[ffmpeg] mirror miss, trying next: %s\n' "$next"
      continue
    fi
    actual=$(sha256_of "$dest.part")
    if [[ "$actual" != "$expected" ]]; then
      rm -f "$dest.part"
      [[ -n "$next" ]] || fail "no source matched sha256 for $(basename "$dest"): $expected"
      printf '[ffmpeg] mirror miss, trying next: %s\n' "$next"
      continue
    fi
    mv "$dest.part" "$dest"
    return 0
  done
}

while (($#)); do
  case "$1" in
    --target) TARGET=${2:?missing value for --target}; shift 2 ;;
    --out) OUT=${2:?missing value for --out}; shift 2 ;;
    --sources) SOURCES=${2:?missing value for --sources}; shift 2 ;;
    --profile) PROFILE=${2:?missing value for --profile}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

PROFILE_FILE="$SCRIPT_DIR/profile-$PROFILE.txt"
[[ -f "$PROFILE_FILE" ]] || fail "unknown profile: $PROFILE"
if grep -q -- '--enable-nonfree' "$PROFILE_FILE"; then
  fail "profile enables nonfree components"
fi

TARGET=${TARGET:-$(host_triple)}
case "$TARGET" in
  aarch64-apple-darwin|x86_64-apple-darwin)
    [[ "$(uname -s)" == Darwin ]] || fail "$TARGET must be built on macOS"
    ;;
  x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
    [[ "$(uname -s)" == Linux ]] || fail "$TARGET must be built on Linux"
    ;;
  *) fail "unsupported target: $TARGET" ;;
esac

for tool in curl tar make pkg-config cc strip; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing tool: $tool"
done
if [[ "$(uname -m)" == x86_64 ]]; then
  # nasm is x86_64 only. arm64 x264 uses the clang assembler.
  command -v nasm >/dev/null 2>&1 || fail "missing tool: nasm"
fi

CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/unplatform-ai-build/ffmpeg"
OUT=${OUT:-"$CACHE_ROOT/$FFMPEG_VERSION-$PROFILE/$TARGET"}
WORK=${FFMPEG_BUILD_WORK:-"$CACHE_ROOT/work/$FFMPEG_VERSION-$PROFILE-$TARGET"}
SRC="$WORK/src"
PREFIX="$WORK/prefix"
# The binary is copied, never installed. A fixed prefix keeps buildconf free of home paths.
FFMPEG_PREFIX=/opt/unplatform-ai-ffmpeg
JOBS=$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)

PROFILE_FLAGS=()
while IFS= read -r line; do
  line=${line%%#*}
  line=$(printf '%s' "$line" | tr -d '[:space:]')
  [[ -z "$line" ]] && continue
  PROFILE_FLAGS+=("$line")
done < "$PROFILE_FILE"

mkdir -p "$WORK" "$SRC" "$PREFIX" "$OUT"
DEST="$OUT/ffmpeg-$TARGET"

copy_sources() {
  [[ -n "$SOURCES" ]] || return 0
  mkdir -p "$SOURCES"
  cp "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" "$SRC/x264-$X264_COMMIT.tar.bz2" \
    "$SRC/zlib-$ZLIB_VERSION.tar.gz" "$SOURCES/"
  printf '[ffmpeg] sources copied %s\n' "$SOURCES"
}

FFMPEG_URLS=(
  "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
)
X264_URLS=(
  "https://code.videolan.org/videolan/x264/-/archive/$X264_COMMIT/x264-$X264_COMMIT.tar.bz2"
)
# zlib.net only serves the current release, older ones live under fossils.
ZLIB_URLS=(
  "https://zlib.net/fossils/zlib-$ZLIB_VERSION.tar.gz"
  "https://github.com/madler/zlib/releases/download/v$ZLIB_VERSION/zlib-$ZLIB_VERSION.tar.gz"
)

download_verify "$FFMPEG_SHA256" "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" "${FFMPEG_URLS[@]}"
download_verify "$X264_SHA256" "$SRC/x264-$X264_COMMIT.tar.bz2" "${X264_URLS[@]}"
download_verify "$ZLIB_SHA256" "$SRC/zlib-$ZLIB_VERSION.tar.gz" "${ZLIB_URLS[@]}"

if [[ -f "$DEST" ]]; then
  "$SCRIPT_DIR/verify.sh" "$DEST"
  copy_sources
  printf '[ffmpeg] cached binary %s\n' "$DEST"
  exit 0
fi

rm -rf "$WORK/ffmpeg" "$WORK/x264" "$WORK/zlib" "$WORK/zlib-$ZLIB_VERSION" "$PREFIX"
mkdir -p "$PREFIX"

tar -xJf "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" -C "$WORK"
tar -xjf "$SRC/x264-$X264_COMMIT.tar.bz2" -C "$WORK"
mv "$WORK/ffmpeg-$FFMPEG_VERSION" "$WORK/ffmpeg"
mv "$WORK/x264-$X264_COMMIT" "$WORK/x264"

printf '[ffmpeg] build x264 %s\n' "$X264_COMMIT"
if [[ "$(uname -s)" == Darwin ]]; then
  (
    cd "$WORK/x264"
    ./configure --prefix="$PREFIX" --enable-static --disable-shared --enable-pic \
      --disable-cli --extra-cflags="-mmacosx-version-min=13.0" \
      --extra-asflags="-mmacosx-version-min=13.0"
  )
else
  (
    cd "$WORK/x264"
    ./configure --prefix="$PREFIX" --enable-static --disable-shared --enable-pic --disable-cli
  )
fi
make -C "$WORK/x264" -j"$JOBS"
make -C "$WORK/x264" install

if [[ "$(uname -s)" == Linux ]]; then
  printf '[ffmpeg] build zlib %s\n' "$ZLIB_VERSION"
  tar -xzf "$SRC/zlib-$ZLIB_VERSION.tar.gz" -C "$WORK"
  (
    cd "$WORK/zlib-$ZLIB_VERSION"
    CFLAGS="-fPIC" ./configure --static --prefix="$PREFIX"
    make -j"$JOBS"
    make install
  )
else
  printf '[ffmpeg] use system zlib %s\n' "$ZLIB_VERSION"
fi

printf '[ffmpeg] build ffmpeg %s (%s)\n' "$FFMPEG_VERSION" "$PROFILE"
if [[ "$(uname -s)" == Darwin ]]; then
  (
    cd "$WORK/ffmpeg"
    PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
      ./configure --prefix="$FFMPEG_PREFIX" "${PROFILE_FLAGS[@]}" \
      --extra-cflags="-mmacosx-version-min=13.0" \
      --extra-ldflags="-mmacosx-version-min=13.0"
  )
else
  (
    cd "$WORK/ffmpeg"
    PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
      ./configure --prefix="$FFMPEG_PREFIX" "${PROFILE_FLAGS[@]}" \
      --extra-ldflags="-static-libgcc"
  )
fi
make -C "$WORK/ffmpeg" -j"$JOBS"

BIN="$WORK/ffmpeg/ffmpeg"
[[ -f "$BIN" ]] || fail "ffmpeg build produced no binary"
if [[ "$(uname -s)" == Darwin ]]; then
  strip -x "$BIN"
else
  strip --strip-all "$BIN"
fi

cp "$BIN" "$DEST"
chmod +x "$DEST"
"$SCRIPT_DIR/verify.sh" "$DEST"
"$DEST" -hide_banner -buildconf > "$OUT/buildconf.txt"
copy_sources

printf '[ffmpeg] binary %s\n' "$DEST"
printf '[ffmpeg] size %s\n' "$(du -h "$DEST" | cut -f1)"
printf '[ffmpeg] sources\n'
printf '  ffmpeg %s %s %s\n' "$FFMPEG_VERSION" "$FFMPEG_SHA256" "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz"
printf '  x264 %s %s %s\n' "$X264_COMMIT" "$X264_SHA256" "$SRC/x264-$X264_COMMIT.tar.bz2"
printf '  zlib %s %s %s\n' "$ZLIB_VERSION" "$ZLIB_SHA256" "$SRC/zlib-$ZLIB_VERSION.tar.gz"
