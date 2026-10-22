# Media fixtures

Generated with ffmpeg test sources. No third-party content.

| File | Streams | Source |
|---|---|---|
| `sample.mp4` | H.264 320x240, AAC | `testsrc2` + `sine`, 1 s |
| `sample.mov` | HEVC 160x120 | `testsrc2`, 1 s |
| `sample.webm` | VP9 160x120, Opus | `testsrc2` + `sine`, 1 s |
| `sample.ogg` | Vorbis | `sine`, 1 s |
| `sample.opus` | Opus | `sine`, 1 s |
| `sample.mp3` | MP3 | `sine`, 1 s |
| `sample.wav` | PCM s16le 8 kHz mono | `sine`, 1 s |
| `sample.png` | PNG RGBA 64x64 | `color=red@0.5`, one frame |
| `sample.jpg` | MJPEG 64x64 | `color=blue`, one frame |
| `sample.webp` | WebP 64x64 | `color=green`, one frame |

Every file is under 50 KB.

Generated on macOS 15 with Homebrew ffmpeg 8.1.1. `sample.ogg` and `sample.webp` used the project's `ffmpeg-static` 6.0 because the Homebrew build lacks libvorbis and libwebp encoders. The commands:

```bash
ffmpeg -f lavfi -i testsrc2=size=320x240:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 1 -shortest -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -c:a aac -b:a 48k \
  -movflags +faststart sample.mp4
ffmpeg -f lavfi -i testsrc2=size=160x120:rate=24 -t 1 -c:v libx265 -preset ultrafast -crf 30 \
  -pix_fmt yuv420p -tag:v hvc1 -an sample.mov
ffmpeg -f lavfi -i testsrc2=size=160x120:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 1 -shortest -c:v libvpx-vp9 -crf 50 -b:v 0 -c:a libopus -b:a 24k sample.webm
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=44100 -t 1 -c:a libvorbis -q:a 0 sample.ogg
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=48000 -t 1 -c:a libopus -b:a 24k sample.opus
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=22050 -t 1 -c:a libmp3lame -b:a 32k -ac 1 sample.mp3
ffmpeg -f lavfi -i sine=frequency=440:sample_rate=8000 -t 1 -c:a pcm_s16le -ac 1 sample.wav
ffmpeg -f lavfi -i color=c=red@0.5:s=64x64 -frames:v 1 -vf format=rgba sample.png
ffmpeg -f lavfi -i color=c=blue:s=64x64 -frames:v 1 -q:v 5 sample.jpg
ffmpeg -f lavfi -i color=c=green:s=64x64 -frames:v 1 -c:v libwebp sample.webp
```
