#!/usr/bin/env bash
# Renames build bundles to the release asset names, pairing updater .sig files.
set -euo pipefail

bundle=${1:?bundle}
version=${2:?version}
target=${3:?target}
dist=${4:?dist}

case "$target" in
  aarch64-apple-darwin) platform=macos; arch=arm64 ;;
  x86_64-pc-windows-msvc) platform=windows; arch=x64 ;;
  x86_64-unknown-linux-gnu) platform=linux; arch=x64 ;;
  *) echo "::error::unsupported target $target" >&2; exit 1 ;;
esac

mkdir -p "$dist"

find "$bundle" -type f \
  \( -name '*.dmg' -o -name '*-setup.exe' -o -name '*.AppImage' -o -name '*.deb' -o -name '*.rpm' -o -name '*.app.tar.gz' \) \
  | sort \
  | while IFS= read -r file; do
      case "$file" in
        *-setup.exe) suffix="-setup.exe" ;;
        *.dmg) suffix=".dmg" ;;
        *.AppImage) suffix=".AppImage" ;;
        *.deb) suffix=".deb" ;;
        *.rpm) suffix=".rpm" ;;
        *.app.tar.gz) suffix=".app.tar.gz" ;;
        *) continue ;;
      esac
      dest="$dist/unplatform-ai-$version-$platform-$arch$suffix"
      mv "$file" "$dest"
      case "$suffix" in
        -setup.exe|.AppImage|.app.tar.gz)
          [[ -f "$file.sig" ]] || { echo "::error::missing updater signature for $file" >&2; exit 1; }
          mv "$file.sig" "$dest.sig"
          ;;
      esac
    done

ls -l "$dist"
