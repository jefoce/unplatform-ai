# Changelog

## 0.3.1 - 2026-10-29

Fewer lost paid videos, a real R2 cap, and thumbnails that recover.

### Added

- Retry download on a video whose download failed, while OpenRouter still has the copy. No new charge.
- Settings warns when your OpenRouter key has no spend limit.

### Changed

- The R2 cap counts everything in the bucket and removes leftover files the app no longer uses, so it stays under 10 GB.
- The app only ever deletes its own files inside its storage folder.

### Fixed

- Finished videos download reliably, even when OpenRouter sends no backup link.
- A submit cut off during Sending warns that the job may exist, so you don't pay twice.
- Thumbnails retry before showing a placeholder, short clips get a poster, and edited linked files show their new thumbnail.
- The "generating" count clears when the running video is filtered out or on another page.
- Escape in a delete confirm no longer clears your selection.

## 0.3.0 - 2026-10-27

A roomier viewer with zoom, a live docked picker, paste and drop anywhere, and one copy per file.

### Added

- A bigger media viewer: blurred backdrop, rounded media without black bars, a close button, previous and next with the arrow keys (Shift+arrows seek), and playback that starts half a second after opening or switching.
- Zoom photos in the viewer: wheel or pinch, drag to move, buttons to zoom and fit.
- A Use button in every viewer adds the media as a reference or start frame, by mode, and shows when it is already attached.
- Frames and input thumbnails open the preview with previous and next.
- Paste or drop files anywhere in the app. In the desktop app, Finder drops link without copying.
- Videos loop until you pause them.

### Changed

- The media picker docks next to the references or frames box. Clicking a file attaches or removes it right away, tiles show the same number as @Image N, and any click outside closes it.
- Uploading or linking the same file again reuses the existing upload.
- Reuse closes the viewer so the loaded settings are visible.

### Fixed

- The Generate button shows no price, discount or spinner while it cannot run.
- A model with no endpoint pricing block logs a clear reason and keeps list prices.
- The preview shows Deselect for a selected file.
- List rows toggle selection with a click, the same as the grid.
- Release pipeline: sidecar and ffmpeg pulls that hit GHCR are reused instead of rebuilt.
- Dropping more files than fit says how many were skipped.

## 0.2.0 - 2026-10-26

Provider and storage layers, stricter lint, stored data validation.

### Added

- The app tells you about new versions and installs them from Settings.
- Unavailable models show as disabled with the reason they cannot run.
- The cost estimate includes the seconds of reference videos.
- Reference durations show their exact values.
- Files chosen in the folder picker are marked before you press Add.
- Step-by-step setup guides for OpenRouter and Cloudflare R2, linked from Settings.
- Settings shows how much R2 storage the app uses.
- List view darkens the video edges on hover, like the grid.

### Fixed

- The Test button in Settings works in the packaged app.
- Glass surfaces no longer render a broken blur on Linux.
- R2 status refreshes after you save the settings.
- Credits no longer show the previous key's numbers after a key change.
- The Cloudflare links in Settings open from the desktop app.

### Changed

- The Linux AppImage steps name the correct FUSE package for Ubuntu 22.04 and 24.04.
- The app keeps R2 storage under 8 GB, inside Cloudflare's free tier, and removes the oldest unused references first.
- The Generate button no longer spins while it is disabled.

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
