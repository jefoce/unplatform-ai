# Third-party notices

Unplatform AI itself is MIT licensed. See [LICENSE](LICENSE).

This file lists the runtimes bundled in desktop installers. The npm section is generated from `pnpm licenses list --prod --json` by `pnpm notices`; run it after dependency changes.

## Bundled runtimes

| Component          | Version                                   | License           | Source                                                                                                                                           |
| ------------------ | ----------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js (custom)   | 24.22.1, built from source with small-icu | MIT               | https://nodejs.org/dist/v24.22.1/node-v24.22.1.tar.xz                                                                                            |
| Node.js (official) | 24.22.1                                   | MIT               | https://github.com/nodejs/node/blob/main/LICENSE                                                                                                 |
| Next.js            | 16.4.2                                    | MIT               | https://github.com/vercel/next.js/blob/canary/license.md                                                                                         |
| React              | 19.3.0                                    | MIT               | https://github.com/facebook/react/blob/main/LICENSE                                                                                              |
| Tauri              | 2.12.4                                    | MIT OR Apache-2.0 | https://github.com/tauri-apps/tauri                                                                                                              |
| ffmpeg             | 9.0.2                                     | GPL-2.0-or-later  | https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz                                                                                                  |
| x264               | b35605ace3ddf7c1a5d67a2eb553f034aef41d55  | GPL-2.0-or-later  | https://code.videolan.org/videolan/x264/-/archive/b35605ace3ddf7c1a5d67a2eb553f034aef41d55/x264-b35605ace3ddf7c1a5d67a2eb553f034aef41d55.tar.bz2 |
| zlib               | 1.3.2                                     | Zlib              | https://zlib.net/zlib-1.3.2.tar.gz                                                                                                               |
| mingw-w64          | 8.0.0-1                                   | ZPL-2.1 AND MIT   | https://github.com/mingw-w64/mingw-w64/tree/v8.0.0                                                                                               |
| sharp              | 0.35.5                                    | Apache-2.0        | https://github.com/lovell/sharp/tree/v0.35.5                                                                                                     |
| @napi-rs/keyring   | 2.1.2                                     | MIT               | https://github.com/Brooooooklyn/keyring-node                                                                                                     |

The bundled libvips 8.18.7 is LGPL-3.0-or-later. Its license text is in [licenses/LICENSE.lgpl3](licenses/LICENSE.lgpl3), which incorporates the GNU GPL version 3 in [licenses/COPYING.GPLv3](licenses/COPYING.GPLv3). The libraries it bundles use the licenses below.

<!-- libvips-bundle:start -->

### libvips libraries

The bundled libvips 8.18.7 includes these libraries. Licenses come from the sharp-libvips licensing table.

| Library       | Version | License                                                                                                   | Source                                                        |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| aom           | 3.15.1  | BSD 2-Clause + [Alliance for Open Media Patent License 1.0](https://aomedia.org/license/patent-license/)  | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libarchive    | 3.8.9   | BSD-2-Clause                                                                                              | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| cairo         | 1.18.6  | MPL-1.1                                                                                                   | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| cgif          | 0.5.4   | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libexif       | 0.6.26  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| expat         | 2.8.5   | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libffi        | 3.8.0   | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| fontconfig    | 2.18.3  | [fontconfig License](https://gitlab.freedesktop.org/fontconfig/fontconfig/blob/main/COPYING) (BSD-like)   | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| freetype      | 2.14.3  | [freetype License](https://git.savannah.gnu.org/cgit/freetype/freetype2.git/tree/docs/FTL.TXT) (BSD-like) | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| fribidi       | 1.0.17  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| glib          | 2.90.0  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| harfbuzz      | 14.5.0  | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libheif       | 1.23.5  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| highway       | 1.4.0   | BSD-3-Clause                                                                                              | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libimagequant | 2.4.1   | [BSD 2-Clause](https://github.com/lovell/libimagequant/blob/main/COPYRIGHT)                               | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| lcms          | 2.19.1  | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| mozjpeg       | 0826579 | [zlib License, IJG License, BSD 3-Clause](https://github.com/mozilla/mozjpeg/blob/master/LICENSE.md)      | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| pango         | 1.58.2  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| pixman        | 0.46.4  | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libpng        | 1.6.58  | [libpng License](https://github.com/pnggroup/libpng/blob/master/LICENSE)                                  | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| proxy-libintl | 0.5     | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| librsvg       | 2.63.2  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libtiff       | 4.7.2   | [libtiff License](https://gitlab.com/libtiff/libtiff/blob/master/LICENSE.md) (BSD-like)                   | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libultrahdr   | 2.0.2   | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libvips       | 8.18.7  | LGPL-3.0-or-later                                                                                         | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libwebp       | 1.6.0   | BSD-3-Clause                                                                                              | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| libxml2       | 2.15.4  | MIT                                                                                                       | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |
| zlib-ng       | 2.3.3   | [zlib License](https://github.com/zlib-ng/zlib-ng/blob/develop/LICENSE.md)                                | https://github.com/lovell/sharp-libvips/tree/v1.3.4#licensing |

<!-- libvips-bundle:end -->

<!-- gstreamer-bundle:start -->

### GStreamer (Linux AppImage)

The AppImage bundles the GStreamer libraries that WebKitGTK needs to play video. Their license text is in [licenses/COPYING.LGPLv2.1](licenses/COPYING.LGPLv2.1).

| Component        | Version      | License           | Source                                                    |
| ---------------- | ------------ | ----------------- | --------------------------------------------------------- |
| GStreamer        | Ubuntu 22.04 | LGPL-2.0-or-later | https://gitlab.freedesktop.org/gstreamer/gstreamer        |
| gst-plugins-base | Ubuntu 22.04 | LGPL-2.0-or-later | https://gitlab.freedesktop.org/gstreamer/gst-plugins-base |
| gst-plugins-good | Ubuntu 22.04 | LGPL-2.1-or-later | https://gitlab.freedesktop.org/gstreamer/gst-plugins-good |
| gst-plugins-bad  | Ubuntu 22.04 | LGPL-2.0-or-later | https://gitlab.freedesktop.org/gstreamer/gst-plugins-bad  |
| gst-libav        | Ubuntu 22.04 | LGPL-2.1-or-later | https://gitlab.freedesktop.org/gstreamer/gst-libav        |

<!-- gstreamer-bundle:end -->

The ffmpeg sidecar is built from the sources pinned in [`scripts/ffmpeg/versions.env`](scripts/ffmpeg/versions.env). macOS and Linux use [`scripts/ffmpeg/build-unix.sh`](scripts/ffmpeg/build-unix.sh), Windows uses [`scripts/ffmpeg/build-windows.sh`](scripts/ffmpeg/build-windows.sh) to cross-compile on Linux. The configure lines for the release targets are generated from `versions.env` and the profile file:

<!-- ffmpeg-buildconf:start -->

### ffmpeg build configure lines

ffmpeg 9.0.2, profile `minimal`. The binary is copied, never installed.

```
# aarch64-apple-darwin
--prefix=/opt/unplatform-ai-ffmpeg --enable-gpl --enable-libx264 --enable-zlib --disable-autodetect --disable-network --disable-doc --disable-debug --disable-ffplay --disable-ffprobe --enable-static --disable-shared --enable-avdevice --enable-indev=lavfi --pkg-config-flags=--static --disable-everything --enable-protocol=file,pipe --enable-demuxer=mov,matroska,mp3,wav,aac,ogg,flac,image2,png_pipe,jpeg_pipe,webp_pipe --enable-decoder=h264,hevc,av1,vp8,vp9,prores,dnxhd,mpeg4,aac,alac,mp3,mp3float,ac3,eac3,opus,vorbis,flac,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,pcm_u8,png,mjpeg,webp,wrapped_avframe --enable-encoder=libx264,aac,png,mjpeg,wrapped_avframe --enable-muxer=mp4,mov,ipod,image2,null --enable-parser=h264,hevc,av1,vp8,vp9,mpeg4video,dnxhd,aac,mpegaudio,opus,vorbis,flac,png,mjpeg,webp --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc,extract_extradata,vp9_superframe_split --enable-filter=scale,format,null,anull,aformat,aresample,trim,atrim,setpts,asetpts,copy,acopy,testsrc2,sine,color,split,drawbox,overlay,transpose,hflip,vflip,fps --enable-indev=lavfi --extra-cflags='-mmacosx-version-min=13.0' --extra-ldflags='-mmacosx-version-min=13.0'
# x86_64-unknown-linux-gnu
--prefix=/opt/unplatform-ai-ffmpeg --enable-gpl --enable-libx264 --enable-zlib --disable-autodetect --disable-network --disable-doc --disable-debug --disable-ffplay --disable-ffprobe --enable-static --disable-shared --enable-avdevice --enable-indev=lavfi --pkg-config-flags=--static --disable-everything --enable-protocol=file,pipe --enable-demuxer=mov,matroska,mp3,wav,aac,ogg,flac,image2,png_pipe,jpeg_pipe,webp_pipe --enable-decoder=h264,hevc,av1,vp8,vp9,prores,dnxhd,mpeg4,aac,alac,mp3,mp3float,ac3,eac3,opus,vorbis,flac,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,pcm_u8,png,mjpeg,webp,wrapped_avframe --enable-encoder=libx264,aac,png,mjpeg,wrapped_avframe --enable-muxer=mp4,mov,ipod,image2,null --enable-parser=h264,hevc,av1,vp8,vp9,mpeg4video,dnxhd,aac,mpegaudio,opus,vorbis,flac,png,mjpeg,webp --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc,extract_extradata,vp9_superframe_split --enable-filter=scale,format,null,anull,aformat,aresample,trim,atrim,setpts,asetpts,copy,acopy,testsrc2,sine,color,split,drawbox,overlay,transpose,hflip,vflip,fps --enable-indev=lavfi --extra-ldflags='-static-libgcc'
# x86_64-pc-windows-msvc
--prefix=/opt/unplatform-ai-ffmpeg --target-os=mingw32 --arch=x86_64 --enable-cross-compile --cross-prefix=x86_64-w64-mingw32- --pkg-config=pkg-config --extra-ldflags='-static' --enable-gpl --enable-libx264 --enable-zlib --disable-autodetect --disable-network --disable-doc --disable-debug --disable-ffplay --disable-ffprobe --enable-static --disable-shared --enable-avdevice --enable-indev=lavfi --pkg-config-flags=--static --disable-everything --enable-protocol=file,pipe --enable-demuxer=mov,matroska,mp3,wav,aac,ogg,flac,image2,png_pipe,jpeg_pipe,webp_pipe --enable-decoder=h264,hevc,av1,vp8,vp9,prores,dnxhd,mpeg4,aac,alac,mp3,mp3float,ac3,eac3,opus,vorbis,flac,pcm_s16le,pcm_s24le,pcm_s32le,pcm_f32le,pcm_f64le,pcm_u8,png,mjpeg,webp,wrapped_avframe --enable-encoder=libx264,aac,png,mjpeg,wrapped_avframe --enable-muxer=mp4,mov,ipod,image2,null --enable-parser=h264,hevc,av1,vp8,vp9,mpeg4video,dnxhd,aac,mpegaudio,opus,vorbis,flac,png,mjpeg,webp --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,aac_adtstoasc,extract_extradata,vp9_superframe_split --enable-filter=scale,format,null,anull,aformat,aresample,trim,atrim,setpts,asetpts,copy,acopy,testsrc2,sine,color,split,drawbox,overlay,transpose,hflip,vflip,fps --enable-indev=lavfi
```

<!-- ffmpeg-buildconf:end -->

No component enables `--enable-nonfree`, so the bundled build is redistributable under GPL-2.0-or-later. License texts are in [`licenses/`](licenses): `COPYING.GPLv2` for FFmpeg and x264, `LICENSE.zlib` for zlib, and `LICENSE.mingw-w64.txt` for the static Windows runtime. The Windows build links winpthreads statically (MIT and ZPL-2.1); libgcc is covered by the GCC Runtime Library Exception and needs no row. The pinned source archives and their SHA-256 sums are listed in `versions.env`; release assets include the same archives for each version.

Rust crates are pinned in `src-tauri/Cargo.lock`. Direct crates use MIT or Apache-2.0, except `keyring` (MIT) and `tauri` and its plugins (MIT OR Apache-2.0).

<!-- npm-licenses:start -->

## npm production dependencies

### 0BSD

- tslib 2.8.1

### Apache-2.0

- @aws-sdk/checksums 3.1001.3
- @aws-sdk/client-s3 3.1152.0
- @aws-sdk/core 3.978.3
- @aws-sdk/credential-provider-env 3.972.74
- @aws-sdk/credential-provider-http 3.972.76
- @aws-sdk/credential-provider-ini 3.973.19
- @aws-sdk/credential-provider-login 3.972.81
- @aws-sdk/credential-provider-node 3.972.86
- @aws-sdk/credential-provider-process 3.972.74
- @aws-sdk/credential-provider-sso 3.973.18
- @aws-sdk/credential-provider-web-identity 3.972.80
- @aws-sdk/lib-storage 3.1152.0
- @aws-sdk/middleware-sdk-s3 3.972.79
- @aws-sdk/nested-clients 3.997.48
- @aws-sdk/s3-request-presigner 3.1152.0
- @aws-sdk/signature-v4-multi-region 3.996.48
- @aws-sdk/token-providers 3.1150.0
- @aws-sdk/types 3.974.6
- @aws-sdk/xml-builder 3.972.41
- @aws/lambda-invoke-store 0.3.0
- @smithy/core 3.36.0
- @smithy/credential-provider-imds 4.5.2
- @smithy/fetch-http-handler 5.8.0
- @smithy/node-http-handler 4.12.1
- @smithy/signature-v4 5.7.4
- @smithy/types 4.19.0
- @swc/helpers 0.5.23
- baseline-browser-mapping 2.11.29
- detect-libc 2.1.2
- sharp 0.35.5

### Apache-2.0 OR MIT

- @tauri-apps/api 2.12.4

### BSD-3-Clause

- ieee754 1.2.1
- source-map-js 1.2.2

### CC-BY-4.0

- caniuse-lite 1.0.30001816

### ISC

- inherits 2.0.4
- lucide-react 1.59.0
- picocolors 1.1.1
- semver 7.8.5

### MIT

- @dnd-kit/accessibility 3.1.1
- @dnd-kit/core 6.3.1
- @dnd-kit/sortable 10.0.0
- @dnd-kit/utilities 3.2.2
- @floating-ui/core 1.8.0
- @floating-ui/dom 1.8.0
- @floating-ui/react 0.27.20
- @floating-ui/react-dom 2.1.9
- @floating-ui/utils 0.2.12
- @img/colour 1.1.0
- @lexical/a11y 0.52.0
- @lexical/clipboard 0.52.0
- @lexical/code-core 0.52.0
- @lexical/devtools-core 0.52.0
- @lexical/dragon 0.52.0
- @lexical/extension 0.52.0
- @lexical/hashtag 0.52.0
- @lexical/history 0.52.0
- @lexical/html 0.52.0
- @lexical/internal 0.52.0
- @lexical/link 0.52.0
- @lexical/list 0.52.0
- @lexical/mark 0.52.0
- @lexical/markdown 0.52.0
- @lexical/overflow 0.52.0
- @lexical/plain-text 0.52.0
- @lexical/react 0.52.0
- @lexical/rich-text 0.52.0
- @lexical/selection 0.52.0
- @lexical/table 0.52.0
- @lexical/text 0.52.0
- @lexical/utils 0.52.0
- @lexical/yjs 0.52.0
- @napi-rs/keyring 2.1.2
- @next/env 16.4.2
- @preact/signals-core 1.14.4
- @radix-ui/number 1.1.3
- @radix-ui/primitive 1.2.0
- @radix-ui/react-accessible-icon 1.2.0
- @radix-ui/react-accordion 1.3.1
- @radix-ui/react-alert-dialog 1.2.1
- @radix-ui/react-arrow 1.1.17
- @radix-ui/react-aspect-ratio 1.2.0
- @radix-ui/react-avatar 1.3.1
- @radix-ui/react-checkbox 1.4.1
- @radix-ui/react-collapsible 1.2.1
- @radix-ui/react-collection 1.2.0
- @radix-ui/react-compose-refs 1.1.5
- @radix-ui/react-context 1.3.0
- @radix-ui/react-context-menu 2.4.1
- @radix-ui/react-dialog 1.3.1
- @radix-ui/react-direction 1.2.0
- @radix-ui/react-dismissable-layer 1.2.1
- @radix-ui/react-dropdown-menu 2.2.1
- @radix-ui/react-focus-guards 1.2.0
- @radix-ui/react-focus-scope 1.3.1
- @radix-ui/react-form 0.3.0
- @radix-ui/react-hover-card 1.2.1
- @radix-ui/react-id 1.1.4
- @radix-ui/react-label 2.1.17
- @radix-ui/react-menu 2.2.1
- @radix-ui/react-menubar 1.2.1
- @radix-ui/react-navigation-menu 1.4.1
- @radix-ui/react-one-time-password-field 0.2.1
- @radix-ui/react-password-toggle-field 0.2.1
- @radix-ui/react-popover 1.3.1
- @radix-ui/react-popper 1.4.0
- @radix-ui/react-portal 1.2.0
- @radix-ui/react-presence 1.1.11
- @radix-ui/react-primitive 2.2.0
- @radix-ui/react-progress 1.2.1
- @radix-ui/react-radio-group 1.5.1
- @radix-ui/react-roving-focus 1.2.1
- @radix-ui/react-scroll-area 1.4.0
- @radix-ui/react-select 2.4.1
- @radix-ui/react-separator 1.2.0
- @radix-ui/react-slider 1.6.1
- @radix-ui/react-slot 1.5.0
- @radix-ui/react-switch 1.4.1
- @radix-ui/react-tabs 1.2.1
- @radix-ui/react-toast 1.3.1
- @radix-ui/react-toggle 1.2.1
- @radix-ui/react-toggle-group 1.2.1
- @radix-ui/react-toolbar 1.2.1
- @radix-ui/react-tooltip 1.4.1
- @radix-ui/react-use-callback-ref 1.1.5
- @radix-ui/react-use-controllable-state 1.3.0
- @radix-ui/react-use-effect-event 0.0.5
- @radix-ui/react-use-escape-keydown 1.1.6
- @radix-ui/react-use-is-hydrated 0.1.3
- @radix-ui/react-use-layout-effect 1.1.4
- @radix-ui/react-use-previous 1.1.4
- @radix-ui/react-use-rect 1.1.4
- @radix-ui/react-use-size 1.1.5
- @radix-ui/react-visually-hidden 1.2.13
- @radix-ui/rect 1.1.3
- @types/trusted-types 2.0.7
- aria-hidden 1.2.6
- base64-js 1.5.1
- bowser 2.14.1
- buffer 5.6.0
- client-only 0.0.1
- clsx 2.1.1
- dequal 2.0.3
- detect-node-es 1.1.0
- events 3.3.0
- get-nonce 1.0.1
- isomorphic.js 0.2.5
- lexical 0.52.0
- lexical-beautiful-mentions 0.1.48
- lib0 0.2.119
- lodash-es 4.18.1
- nanoid 3.3.20
- next 16.4.2
- postcss 8.5.23
- radix-ui 1.8.1
- react 19.3.0
- react-dom 19.3.0
- react-remove-scroll 2.7.2
- react-remove-scroll-bar 2.3.8
- react-style-singleton 2.2.3
- readable-stream 3.6.2
- safe-buffer 5.2.1
- scheduler 0.28.0
- server-only 0.0.1
- sonner 2.0.8
- stream-browserify 3.0.0
- string_decoder 1.3.0
- styled-jsx 5.1.6
- swr 2.5.1
- tabbable 6.5.0
- tailwind-merge 3.7.0
- use-callback-ref 1.3.3
- use-sidecar 1.1.3
- use-sync-external-store 1.7.0
- util-deprecate 1.0.2
- yjs 13.6.33
- zod 4.6.7
- zustand 5.0.15

### MIT OR Apache-2.0

- @tauri-apps/plugin-dialog 2.8.3
- @tauri-apps/plugin-notification 2.7.0
- @tauri-apps/plugin-opener 2.7.2

<!-- npm-licenses:end -->
