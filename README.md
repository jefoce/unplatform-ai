<h1>
  <img src="docs/images/header-light.svg#gh-light-mode-only" height="56" alt="Unplatform AI">
  <img src="docs/images/header-dark.svg#gh-dark-mode-only" height="56" alt="Unplatform AI">
</h1>

> Make AI images and videos with today's most popular high-quality models on your own computer. Pay the model's price through your own OpenRouter key: no subscription, no markup. Every image and video stays on your computer with its settings and real cost.

![Screenshot](docs/images/screenshot.png)

## What you can do

- See the price before you press Generate, and keep the real cost with every image and video.
- Start from text, a picture, or a start and an end picture.
- Generate images in the Image tab, with grid and masonry views, likes, and a floating prompt bar.
- Add reference pictures, clips or sound, and point to them in your text ("the person in Image 1").
- Browse, search and select many images and videos at once, and make any of them again with one click.
- Keep working while images and videos generate. Up to 4 of each run at once, counted separately, and you get a notification when one is ready.

## Models

- Wan 3.0 / Prime
- Seedance 2.0
- Seedance 2.5
- Nano Banana Pro / 2 / 2.1
- Seedream 5 Flash / Lite / Pro
- GPT Image 2 / 2.5
- FLUX 3 Klein

Prices come live from OpenRouter.

## What you need

- A Mac (Apple Silicon), a Windows 10/11 PC, or 64-bit Linux with glibc 2.35+ (Ubuntu 22.04, Debian 12, Fedora 36 or newer).
- An OpenRouter account with some credit. One account gives you many video models, and you pay only for what you generate.
- Optional: a Cloudflare account with R2, only for models that take video or sound references. Cloudflare asks for a card to turn R2 on. The free tier is 10 GB, and the app stays under 8 GB. It deletes references it has not used for 30 days.

## Install

Download the file for your computer from the [Releases page](https://github.com/jefoce/unplatform-ai/releases/latest). On macOS, the download is about 34 MiB, and the app takes about 127 MiB after the first launch.

### macOS

1. Open the `.dmg` and drag Unplatform AI into Applications.
2. Before the first launch, run this in Terminal: `xattr -dr com.apple.quarantine "/Applications/Unplatform AI.app"`
3. If macOS still blocks it, go to System Settings > Privacy & Security, press **Open Anyway** next to Unplatform AI, and confirm.

> [!WARNING]
> The command is only for the file downloaded from this repo. It removes Apple's quarantine flag from that copy. Do not run it on an app you got from anywhere else.

### Windows

1. Run the `-setup.exe`.
2. If you see "Windows protected your PC", press **More info**, then **Run anyway**.

No administrator rights needed. The app appears in the Start menu.

### Linux

The `.deb` and `.rpm` are the recommended packages. They use your system WebKitGTK and GStreamer, so rendering is faster and video can use hardware decoding.

- **Debian or Ubuntu:** `sudo apt install ./unplatform-ai-*-linux-x64.deb`. This is the simplest option on Ubuntu, and it also installs the video playback libraries.
- **Fedora or openSUSE:** `sudo dnf install ./unplatform-ai-*-linux-x64.rpm`.

- **AppImage (portable fallback):** `chmod +x unplatform-ai-*-linux-x64.AppImage`, then run it. It bundles older WebKitGTK and GStreamer libraries, so expect slower rendering and software video decoding.
  If it fails with a FUSE or `libfuse.so.2` error, install FUSE 2 once:
  - Ubuntu 22.04 or Debian 12: `sudo apt install libfuse2`
  - Ubuntu 24.04 or newer: `sudo apt install libfuse2t64`

  Install exactly that package, not `fuse`, which replaces `fuse3` and can remove system packages.
  No FUSE at all: `./unplatform-ai-*-linux-x64.AppImage --appimage-extract-and-run`.

Each release has a `SHA256SUMS.txt` if you want to check your download.

## Updates

The app checks 15 seconds after launch, then every 12 hours, and shows a notice when a new version exists. Settings → **App** has the switch for that check and **Check now**.

- **macOS and Windows:** **Install and restart** downloads the new version and installs it in place.
- **Linux AppImage:** the same button replaces the running AppImage.
- **Linux `.deb` and `.rpm`:** the app cannot replace a system package, so **Install and restart** is not offered. The update notice and Settings → **App** show **Download**, which opens the [Releases page](https://github.com/jefoce/unplatform-ai/releases/latest). Install the new version with `apt` or `dnf` as before.

On macOS, the first launch after an update asks for keychain access once. Choose **Always Allow**.

Version 0.1.0 has no updater. Install 0.2.0 by hand once from the Releases page. Later versions update themselves.

Coming from 0.3.x? Update through the 0.3.2 bridge first. It moves your history, settings and key, then 0.4.0 arrives from the new [Releases page](https://github.com/jefoce/unplatform-ai/releases/latest). The data folder used by 0.3.x moved to `.unplatform-ai`, and 0.4.0 does not read the old one. If you install 0.4.0 by hand without 0.3.2, re-enter your key in Settings.

## Messages your computer may show

The app is not signed with a paid certificate yet, so your system asks more questions than usual. They are all normal.

### macOS

| When                                                                              | Message                                                         | Press                                                                                                               |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| You save keys                                                                     | "…wants to use your confidential information… in your keychain" | Your login password, then **Always Allow**. Pressed Deny? Save again, or delete "unplatform-ai" in Keychain Access. |
| First video is ready                                                              | "…would like to send you notifications"                         | **Allow**. Change it later in System Settings > Notifications.                                                      |
| You use a folder in Desktop, Documents, Downloads, a USB drive or a network share | "…would like to access files in…"                               | **Allow**. Otherwise turn it on in Privacy & Security > Files and Folders. Until then the folder looks empty.       |

After installing a new version by hand from a `.dmg`, run the `xattr` command again before the first launch, then Open Anyway if asked. Updates installed from Settings do not need it. Each unsigned version counts as a new app. The app never needs Full Disk Access, Accessibility, Screen Recording, Camera or Microphone.

### Windows

| When                                                             | Message                        | Press                                                                       |
| ---------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| Installing                                                       | "Windows protected your PC"    | **More info**, then **Run anyway**.                                         |
| Saving to Documents or Pictures with Controlled folder access on | "Unauthorized changes blocked" | Windows Security > Ransomware protection > Allow an app, add Unplatform AI. |

Keys go to Windows Credential Manager without a question.

### Linux

If your keyring is locked when you save keys, Linux asks for your login password. Cancel it and the keys are not saved, settings tells you. Without any keyring, keys go to a private file in your home folder.

## First setup

1. **OpenRouter (required).** Add credit, create a dedicated API key with a spend limit, and paste it in Settings (gear icon). [Step-by-step guide](docs/user/OPENROUTER.md)
2. **Cloudflare R2 (only for video or sound references).** Create a bucket and a token for it, then paste four values in Settings. Free up to 10 GB, and the app stays under 8 GB. Cloudflare asks for a card. [Step-by-step guide](docs/user/CLOUDFLARE-R2.md)

Both guides are also linked in the app: gear icon → **Setup guide**.

## Make your first video

1. Pick the cheapest model at 480p and a short length to try.
2. Describe what should happen. Optional: open the picker beside the generator and click a picture or clip to attach it. Click it again to remove it. In Frames, a click picks the file and closes the picker. Call them Image 1, Video 1, Audio 1 in your text. You can also paste or drop files anywhere in the window. They go to the open picker or to the active tab.
3. Press **Generate**. The button shows the price. You have 10 seconds to cancel before anything is sent or paid.

## Keep the app running until your video is done

The one thing to remember: the video is made on OpenRouter, but the app brings it to your computer. OpenRouter keeps finished videos only for a while (about a day for some models).

- **macOS:** the red close button only hides the window. Quit with Cmd+Q.
- **Windows and Linux:** closing the window quits.
- Quit anyway? Videos keep generating, and the app downloads them when you open it again. Do that within a few hours.
- Don't let the computer sleep for long during a generation.

## What the statuses mean

| Status                       | What is happening                                                                                              | OK to quit?                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Processing                   | 10 seconds before sending, or the model is starting. Cancel works during the first 10 seconds, nothing charged | Better not                                            |
| Uploading                    | Sending reference files to storage, nothing charged                                                            | No, it fails                                          |
| Sending                      | Handing the job to OpenRouter                                                                                  | Yes, it finishes sending first                        |
| Generating                   | The model is making your video or image, charged when it finishes                                              | Yes, reopen within a few hours                        |
| Downloading                  | Saving the finished video to your computer                                                                     | No, wait a moment                                     |
| Completed                    | Saved                                                                                                          | Yes                                                   |
| Failed                       | Usually not charged. The card says why                                                                         | Yes                                                   |
| Expired                      | Charged if it finished. Check OpenRouter activity                                                              | Yes                                                   |
| Cancelled                    | Never sent, nothing charged                                                                                    | Yes                                                   |
| Waiting for ComfyUI          | ComfyUI is busy with another job, charged when it finishes                                                     | Yes, with Stop in ComfyUI                             |
| In queue, N ahead            | Waiting in the ComfyUI queue, charged when it finishes                                                         | Yes, with Stop in ComfyUI                             |
| ComfyUI offline, will resume | ComfyUI is not reachable, charged when it finishes                                                             | Quit is safe. The app checks again on the next start. |

## Where your files are

Everything is in `.unplatform-ai` in your home folder (hidden, on macOS press Cmd+Shift+. in Finder).

- `downloads`: your videos with a preview and settings for each.
- `images`: your generated images with a record and file for each.
- `uploads`: pictures and clips you pasted or dropped. Files picked from your disk are not copied, only linked.
- `data`: the folders you connected for linked files.
- `.cache`: thumbnails. Safe to delete while the app is closed.
- `runtime`: the app's server copy. Restaged on the next launch.

To back up or move to a new computer, copy the whole folder, then enter your keys again.

## Costs and privacy

- Unplatform AI is free and adds no fee. The wallet pill shows what is left of your key's credit limit, or your account balance when you add a management key. The management key is optional and read-only in this app.
- No account, no tracking, no server of ours. Keys stay in your system keychain.
- Your text and pictures go to OpenRouter and the model's provider. Video and sound references go to your own R2 bucket as private links that expire after 2 hours.
- R2 stays inside Cloudflare's free tier, see [the R2 guide](docs/user/CLOUDFLARE-R2.md).

## Keyboard shortcuts

- `Left` and `Right`: previous or next item in the viewer or a preview list.
- `Shift+Left` and `Shift+Right`: seek 5 seconds inside the viewer.
- `+` and `-`: zoom a photo in or out in the viewer.
- `0`: fit a zoomed photo back to the screen.
- `Space`: play or pause a focused player.
- `F`: fullscreen for a focused player.
- `Escape`: close a dialog or clear the selection.

## Something went wrong?

| What you see                                                                 | What to do                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Your OpenRouter key is not set."                                            | Save your key in Settings (gear icon).                                                                                                                                    |
| "Your OpenRouter key is not valid."                                          | The key expired or was deleted. Create a new one ([guide](docs/user/OPENROUTER.md)) and paste it in Settings.                                                             |
| "needs cloud storage (R2)"                                                   | Set up R2, or use pictures instead of video or sound.                                                                                                                     |
| "Cloud storage is full."                                                     | Wait 2 hours, or use shorter clips. Older references are removed automatically.                                                                                           |
| "takes video references as mp4 or mov"                                       | Convert the clip to mp4.                                                                                                                                                  |
| A model blocks images that look like real people                             | Use a different image, or another model.                                                                                                                                  |
| "Waiting for keychain access"                                                | A system prompt is open, maybe behind a window. Choose Always Allow.                                                                                                      |
| A video says Expired                                                         | Make it again with Reuse. Check OpenRouter activity for a charge.                                                                                                         |
| Videos don't play on Linux                                                   | Install the `.deb`, or `gstreamer1.0-plugins-good gstreamer1.0-libav`.                                                                                                    |
| Settings says "Keys could not be saved. The system keychain is unavailable." | macOS: open Keychain Access and check the login keychain is unlocked, then press Retry. Windows: sign in to Windows normally (not a temporary profile), then press Retry. |
| Anything else                                                                | Send the last lines of `.unplatform-ai/logs/server.log`.                                                                                                                  |

## Uninstall

Delete the app, then the `.unplatform-ai` folder if you don't want your videos. Remove the saved keys by searching "unplatform-ai" in Keychain Access, Windows Credential Manager or your Linux keyring.

## What's next

Ideas, depending on how many people use the app: more video and image models, and simple editing (trim videos, crop and resize pictures). Want one sooner? Open or upvote an issue.

## For developers

[DEVELOPMENT.md](docs/DEVELOPMENT.md) · [ARCHITECTURE.md](docs/ARCHITECTURE.md) · [SECURITY.md](docs/SECURITY.md) · [DECISIONS.md](docs/DECISIONS.md) · [OpenRouter guide](docs/user/OPENROUTER.md) · [Cloudflare R2 guide](docs/user/CLOUDFLARE-R2.md)

Run `pnpm dev` and open the session link it prints at startup.

Dependabot pull requests into `releases` are never merged. They stay open with the `apply-on-next` label as a reminder, and the update is applied on the next version branch. Branch protection can optionally require the `apply-on-next` check.

---

Installers bundle custom ffmpeg 9.0.2 (x264, zlib) and Node.js 24 builds from pinned sources. Licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Not affiliated with any commercial AI video platform.
