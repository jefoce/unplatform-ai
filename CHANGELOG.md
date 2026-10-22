# Changelog

## 0.1.0 - 2026-10-22

First release.

### Added

- A local studio for Wan 3.0, Wan 3.0 Prime, Seedance 2.0 and Seedance 2.5, with text, start frame, start and end frames, and image, video or audio references.
- History with search, filters, rerun, thumbnails and previews, multi-select with batch download, like and delete, plus the real cost reported by OpenRouter.
- 4K image references with automatic size steps.
- Background generation with notifications, a visible Downloading stage and a summary of videos that changed while the app was closed.
- Optional Cloudflare R2 storage for models that need links, with 2 hour links and 30 day cleanup.
- macOS, Windows and Linux builds published to GitHub Releases, with checksums.
- Status tooltips and plain-language provider errors, with the raw provider detail available on demand.
- Downloads retry every minute when the disk is full.
- A custom Node 24 small-ICU runtime. The app is 138 MiB and the DMG is 50 MiB (measured).
- Keychain storage on macOS and Windows, keyring or a private file on Linux.
