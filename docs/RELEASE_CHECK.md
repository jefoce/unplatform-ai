# Release check

Run this on an installed rc build, not a dev build. Use mock providers only (`OPENROUTER_MOCK=1`, `REMOTE_MOCK=1`, `CUSTOM_ENDPOINT_MOCK=1`). Record pass or fail and the evidence for every line. Any fail blocks the release.

## Steps

1. Install the rc, launch it, and confirm the first launch extracts the server and the feed loads. Note the duration and any error.
2. Mock-generate 1 image and 1 video. Confirm both complete and appear in history.
3. Start an image send, quit the app during the send, then relaunch. Confirm the job resumes or ends terminal, not stuck.
4. Measure the installed size: the app plus the extracted runtime folder.
5. On Windows, run a Defender scan on the installer and on the installed app.
6. Generate one cheap image and confirm the balance updates within about 20 s.
7. Add a custom endpoint, press Test, mock-generate one image, then delete the endpoint and confirm the warning.

## Desktop checks not run by automation

Run these by hand on the installed rc, with mock providers only.

| Check | Result | Evidence |
|---|---|---|
| First launch extracts the runtime, and the folder holds only the server and the build stamp | | |
| Second launch reuses the runtime without extracting | | |
| Settings: mock key, mock-generate 1 video and 1 image, both finish with tile, viewer, like, delete and Reference | | |
| Settings: custom endpoint added, Test passes, mock image generated, delete warns | | |
| Upload a mov, mp3 and webp, each gets a thumbnail, probe and poster | | |
| A second instance refuses cleanly while the first runs | | |
| `codesign -v --deep` passes, and `xattr -r` shows no quarantine on the runtime | | |
| Image tab and video tab at 1280 and 2560 px: no gap, island steady, masonry full width, rounded viewer, round checkboxes | | |
| Old data: launch over the previous build's `~/.unplatform-ai`, old runtime pruned, history, uploads and settings intact | | |

## Image models

With the mock provider on, pick each image model once. Confirm none is marked "Not available on OpenRouter right now".

| Check | Result | Evidence |
|---|---|---|
| Every image model picked, none unavailable | | |

## macOS arm64

| Check | Result | Evidence |
|---|---|---|
| First launch extracts | | |
| Mock image generated | | |
| Mock video generated | | |
| Quit during image send, relaunch | | |
| Installed size | | |

## Windows x64

| Check | Result | Evidence |
|---|---|---|
| First launch extracts | | |
| Mock image generated | | |
| Mock video generated | | |
| Quit during image send, relaunch | | |
| Installed size | | |
| Defender scan | | |

## Linux AppImage

| Check | Result | Evidence |
|---|---|---|
| First launch extracts | | |
| Mock image generated | | |
| Mock video generated | | |
| Quit during image send, relaunch | | |
| Installed size | | |

## Linux deb

| Check | Result | Evidence |
|---|---|---|
| First launch extracts | | |
| Mock image generated | | |
| Mock video generated | | |
| Quit during image send, relaunch | | |
| Installed size | | |
