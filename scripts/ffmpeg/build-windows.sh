#!/usr/bin/env bash
# Cross-compiles pinned GPL ffmpeg for x86_64 Windows on Linux with mingw-w64.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=versions.env
source "$SCRIPT_DIR/versions.env"

PROFILE=full
TARGET=x86_64-pc-windows-msvc
OUT=""
SOURCES=""
CROSS=x86_64-w64-mingw32-
PREPARE_ONLY=0

usage() {
  printf 'usage: %s [--target x86_64-pc-windows-msvc] [--out <dir>] [--sources <dir>] [--profile full|minimal] [--prepare-only]\n' "$(basename "$0")"
}

fail() {
  printf '[ffmpeg] error: %s\n' "$*" >&2
  exit 1
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

write_buildconf() {
  local wine=""
  local prefix=""
  local output=""

  if command -v wine64 >/dev/null 2>&1; then
    wine=wine64
  elif [[ -x /usr/lib/wine/wine64 ]]; then
    wine=/usr/lib/wine/wine64
  elif command -v wine >/dev/null 2>&1; then
    wine=wine
  fi

  if [[ -z "$wine" ]]; then
    printf '[ffmpeg] warning: wine not found, buildconf.txt not written\n' >&2
    return 0
  fi

  prefix=$(mktemp -d)
  output=$(WINEDEBUG=-all WINEPREFIX="$prefix" "$wine" "$DEST" -hide_banner -buildconf 2>/dev/null | tr -d '\r' || true)
  rm -rf "$prefix"

  if [[ "$output" != *"configuration:"* ]]; then
    printf '[ffmpeg] error: buildconf output is not valid\n' >&2
    return 1
  fi

  printf '%s\n' "$output" > "$OUT/buildconf.txt"
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
    --prepare-only) PREPARE_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown argument: $1" ;;
  esac
done

HOST_OS=$(uname -s)
if ((PREPARE_ONLY)); then
  [[ "$HOST_OS" == Linux || "$HOST_OS" == Darwin ]] || fail "--prepare-only supports only Darwin or Linux"
else
  [[ "$HOST_OS" == Linux ]] || fail "Windows cross-build must run on Linux"
fi
[[ "$TARGET" == x86_64-pc-windows-msvc ]] || fail "unsupported target: $TARGET"

PROFILE_FILE="$SCRIPT_DIR/profile-$PROFILE.txt"
[[ -f "$PROFILE_FILE" ]] || fail "unknown profile: $PROFILE"
if grep -q -- '--enable-nonfree' "$PROFILE_FILE"; then
  fail "profile enables nonfree components"
fi

for tool in curl tar; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing tool: $tool"
done
if ((!PREPARE_ONLY)); then
  for tool in make pkg-config nasm \
    "${CROSS}gcc" "${CROSS}g++" "${CROSS}ar" "${CROSS}strip" "${CROSS}objdump"; do
    command -v "$tool" >/dev/null 2>&1 || fail "missing tool: $tool"
  done

  gcc_info=$("${CROSS}gcc" -v 2>&1)
  THREAD_MODEL=$(sed -n 's/^Thread model: //p' <<< "$gcc_info")
  if [[ "$THREAD_MODEL" != posix ]]; then
    fail "mingw gcc uses '$THREAD_MODEL' threads, need posix: sudo update-alternatives --set x86_64-w64-mingw32-gcc /usr/bin/x86_64-w64-mingw32-gcc-posix"
  fi
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
DEST="$OUT/ffmpeg-$TARGET.exe"

copy_sources() {
  [[ -n "$SOURCES" ]] || return 0
  mkdir -p "$SOURCES"
  cp "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" "$SRC/x264-$X264_COMMIT.tar.bz2" \
    "$SRC/zlib-$ZLIB_VERSION.tar.gz" "$SOURCES/"
  printf '[ffmpeg] sources copied %s\n' "$SOURCES"
}

check_imports() {
  local bin=$1 imports
  imports=$("${CROSS}objdump" -p "$bin" | sed -n 's/^[[:space:]]*DLL Name: //p' | tr -d '\r' | sort -u)
  printf '[ffmpeg] DLL imports\n'
  if [[ -n "$imports" ]]; then
    printf '%s\n' "$imports" | sed 's/^/  /'
  fi
  if grep -Eiq 'libwinpthread|libgcc|libstdc|libssp|zlib1\.dll|libx264' <<< "$imports"; then
    fail "non-system DLL import found"
  fi
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

if ((PREPARE_ONLY)); then
  if [[ ! -d "$WORK/ffmpeg" ]]; then
    tar -xJf "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" -C "$WORK"
    mv "$WORK/ffmpeg-$FFMPEG_VERSION" "$WORK/ffmpeg"
  fi
  if [[ ! -d "$WORK/x264" ]]; then
    tar -xjf "$SRC/x264-$X264_COMMIT.tar.bz2" -C "$WORK"
    mv "$WORK/x264-$X264_COMMIT" "$WORK/x264"
  fi
  if [[ ! -d "$WORK/zlib-$ZLIB_VERSION" ]]; then
    tar -xzf "$SRC/zlib-$ZLIB_VERSION.tar.gz" -C "$WORK"
  fi
  printf '[ffmpeg] work %s\n' "$WORK"
  exit 0
fi

if [[ -f "$DEST" ]]; then
  check_imports "$DEST"
  copy_sources
  write_buildconf
  printf '[ffmpeg] cached binary %s\n' "$DEST"
  exit 0
fi

rm -rf "$WORK/ffmpeg" "$WORK/x264" "$WORK/zlib" "$WORK/zlib-$ZLIB_VERSION" "$PREFIX"
mkdir -p "$PREFIX/bin" "$PREFIX/include" "$PREFIX/lib"

tar -xJf "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz" -C "$WORK"
tar -xjf "$SRC/x264-$X264_COMMIT.tar.bz2" -C "$WORK"
tar -xzf "$SRC/zlib-$ZLIB_VERSION.tar.gz" -C "$WORK"
mv "$WORK/ffmpeg-$FFMPEG_VERSION" "$WORK/ffmpeg"
mv "$WORK/x264-$X264_COMMIT" "$WORK/x264"

printf '[ffmpeg] cross-build x264 %s\n' "$X264_COMMIT"
(
  cd "$WORK/x264"
  ./configure --host=x86_64-w64-mingw32 --cross-prefix="$CROSS" --prefix="$PREFIX" \
    --enable-static --disable-shared --disable-cli
)
make -C "$WORK/x264" -j"$JOBS"
make -C "$WORK/x264" install

printf '[ffmpeg] cross-build zlib %s\n' "$ZLIB_VERSION"
make -C "$WORK/zlib-$ZLIB_VERSION" -f win32/Makefile.gcc \
  PREFIX="$CROSS" BINARY_PATH="$PREFIX/bin" INCLUDE_PATH="$PREFIX/include" \
  LIBRARY_PATH="$PREFIX/lib" install

printf '[ffmpeg] cross-build ffmpeg %s (%s)\n' "$FFMPEG_VERSION" "$PROFILE"
(
  cd "$WORK/ffmpeg"
  PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig" PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig" \
    ./configure --prefix="$FFMPEG_PREFIX" --target-os=mingw32 --arch=x86_64 \
    --enable-cross-compile --cross-prefix="$CROSS" --pkg-config=pkg-config \
    --extra-ldflags="-static" "${PROFILE_FLAGS[@]}"
)
make -C "$WORK/ffmpeg" -j"$JOBS"

BIN="$WORK/ffmpeg/ffmpeg.exe"
[[ -f "$BIN" ]] || fail "ffmpeg build produced no binary"
"${CROSS}strip" "$BIN"

check_imports "$BIN"

cp "$BIN" "$DEST"
chmod +x "$DEST"
write_buildconf

printf '[ffmpeg] binary %s\n' "$DEST"
printf '[ffmpeg] size %s\n' "$(du -h "$DEST" | cut -f1)"
printf '[ffmpeg] sources\n'
printf '  ffmpeg %s %s %s\n' "$FFMPEG_VERSION" "$FFMPEG_SHA256" "$SRC/ffmpeg-$FFMPEG_VERSION.tar.xz"
printf '  x264 %s %s %s\n' "$X264_COMMIT" "$X264_SHA256" "$SRC/x264-$X264_COMMIT.tar.bz2"
printf '  zlib %s %s %s\n' "$ZLIB_VERSION" "$ZLIB_SHA256" "$SRC/zlib-$ZLIB_VERSION.tar.gz"
