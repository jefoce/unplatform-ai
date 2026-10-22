# Decisions

## 2026-10-23 - Server-owned price estimate

Decision: estimate is a price-only server route. `buildPriceInputSchema` has presetId, tab, audio, duration, aspectRatio, resolution, frames, references. Client sends no prompt or seed. SWR key uses those fields, disables focus and stale revalidation, keeps previous data. Spinner covers only the debounce and first key fetch. Create keeps full validation. Actual `usage.cost` wins.

Why: one formula, no client drift, estimate cannot fail on prompt, active count or R2.

Rejected: client-side total. A server-only estimate after submit with no pre-submit price.

## 2026-10-23 - Reference video billed as input seconds

Decision: `referenceVideoFactor` is 1 for Wan and Seedance. Billed seconds = output plus reference video seconds. Reference image and audio are free.

Measured: Wan 3.0, 5 s 480p plus 2 s reference, estimate 0.2975, actual 0.2975. Seedance 2.0, 4 s 480p plus 2 s reference, estimate 0.2479, actual 0.3041 because of an unmodeled token floor. Prime and Seedance 2.5 unverified.

Why: provider docs bill input plus output.

Rejected: factor 0 for Seedance. `video_tokens_with_video_input` is a lower per-token rate, not a replacement for input tokens.

## 2026-10-23 - Folder picker links only on Add

Decision: multi-select folder clicks only toggle a ring. Preview uses a read-only `PreviewItem` with `previewRef`, no upload record. Add links and commits. Single-select links immediately because there is no Add button.

Why: browsing must not create uploads.

Rejected: link on click and clean up on cancel.

## 2026-10-23 - R2 status waits for secrets

Decision: `/api/remote/status` awaits `secretsReady()` before `getRemoteStore()`. Client status is undefined while loading and validation warns only on false.

Why: the packaged keychain bridge can answer after the first status request, and caching null produced a stale R2 warning.

Rejected: focus revalidation and polling.

## 2026-10-23 - Integer duration ranges

Decision: preset options are quick picks. Any integer in range is allowed. Wan 3.0 and Prime 2-30 with total input plus output at most 30 s. Seedance 2.0 4-15. Seedance 2.5 4-30. Reference limit stays strict, so 15.02 s is rejected. Cards show exact two-decimal durations.

Why: provider docs and OpenRouter `supported_durations` list every integer, so no `durationMode` field is justified.

Rejected: fixed option enums.

## 2026-10-22 - Custom small-ICU Node

Decision: build Node 24.22.1 from pinned source with `small-icu`, no npm and no corepack.

Why: the custom binary is 65.0 MiB against 116.9 MiB for official Node 24.22.1, saving 51.9 MiB per app, measured 2026-10-22. The macOS build targets `minos` 13.0.

Rejected: the official binary, which is much larger and carries npm and corepack.

## 2026-10-22 - GHCR sidecar storage

Decision: publish sidecars as public GHCR packages keyed by a hash of `scripts/<name>`, the target triple, the runner image and the ffmpeg profile.

Why: Actions cache is ref-scoped, so a tag run misses artifacts built on another ref. GHCR tags are shared by every run.

Rejected: the Actions cache as the source of truth for sidecars.

## 2026-10-22 - Releases branch, squash merge, deferred tag

Decision: work on version branch `X.Y.Z`, open a pull request titled `Unplatform AI X.Y.Z`, squash merge into `releases`, and let the workflow tag `vX.Y.Z` only after every job passes.

Why: a tag created before the builds would point at a commit whose release never finished, and the tag job needs the draft assets.

Rejected: tagging before the builds complete.

## 2026-10-22 - Linux-only secrets file fallback

Decision: the file secrets backend exists only on Linux. On macOS and Windows an unavailable keychain is an error and generation stays disabled. `UPAI_SECRETS_BACKEND=file` is a development-only override outside production.

Why: the file fallback is protected by permissions alone, which is weaker than the keychain and only needed on Linux boxes without a keyring service.

Rejected: a cross-platform file fallback.

## 2026-10-22 - Smoke answers the secrets bridge

Decision: the smoke test answers `@@upai-secrets` in memory (`getAll`, `get`, `set`, `remove`) instead of forcing the file backend.

Why: it exercises the real bridge path without adding a production bypass, and the file backend stays Linux only.

Rejected: overriding the backend to `file` in smoke.

## 2026-10-22 - Whole native package staging

Decision: copy the `@img` and `@napi-rs` packages whole into the staged tree, and on macOS ad-hoc sign every Mach-O under the staged server.

Why: Next traces sharp's `.node` but not the Windows libvips DLLs beside it, so pruning per file breaks Windows. Foreign or linker signatures on staged binaries trigger a second Gatekeeper prompt.

Rejected: pruning native packages to the traced entry files.

## 2026-10-22 - Node 24 LTS

Node 24.22.1 used. Node 24 is maintenance LTS since 20 October 2026 and supported to 30 April 2028. Node 22 leaves maintenance LTS on 30 April 2027. Node 26 becomes LTS on 28 October 2026, move to it in a later minor a few months into its LTS.

## 2026-10-22 - 120 Hz page rendering

Decision: after the window is built, turn off WebKit's `PreferPageRenderingUpdatesNear60FPSEnabled` feature through the private `WKPreferences` selectors `_features` and `_setEnabled:forFeature:`.

Why: WKWebView caps page rendering near 60 fps on ProMotion displays. The private API lifts the cap, so scrolling and video playback use the full display refresh rate.

Rejected: leaving the cap at 60 fps. Not App Store safe because it uses private API. Direct distribution only. Each selector is checked with `respondsToSelector:` and the call is wrapped in `catch_unwind`, so a future macOS without the API stays at 60 fps.

## 2026-10-20 - Scaffold merged in place

The project root already held PLAN.md and docs/, so create-next-app ran in a temp directory and its files were merged into the root. No second git repository was created.

## 2026-10-20 - Reference path

Visual references live in docs/references/. PLAN.md says docs/reference/, but the supplied folder name wins.

## 2026-10-20 - TMPDIR workaround

The default TMPDIR points to a missing directory. pnpm commands run with TMPDIR=/private/tmp.

## 2026-10-20 - Mock mode default

.env.local sets OPENROUTER_MOCK=1 so development jobs do not call the API or incur cost.

## 2026-10-20 - OpenRouter request shapes

Docs confirmed frame_images with image_url and frame_type, input_references as a type union, optional prompt with frames, GET jobs without progress or timestamps, relative polling_url, and pricing SKU keys of the form duration_seconds_<resolution>.

## 2026-10-20 - Mock timeline

Mock jobs stay pending for 3 seconds, then in_progress for 6 seconds, and the mock video is generated locally.

## 2026-10-20 - wan-3.0 reference kinds

Docs describe input_references for wan-3.0 as images only, but the app still allows video and audio references per user decision and surfaces provider errors.

## 2026-10-20 - History text mode filter

The text-only mode tab is a client-side post-filter over loaded records. Prompt search is applied server-side with the other filters.

## 2026-10-20 - Add as reference

Add-as-reference downloads the mp4 in the browser and uploads a copy through the existing uploads route, so no new API route was added.

## 2026-10-20 - Seed Randomize

The Randomize button picks a fixed random number while the Random switch stays off. Toggle the switch for server-random seeds.

## 2026-10-20 - Request size guard

The total request size check runs before the generation record is written.

## 2026-10-20 - Mock content fallback

After a restart, mock content uses record.input as the fallback source for dimensions and duration.

## 2026-10-20 - Browse errors

Directory browse failures throw typed BrowseError values with status 400 for invalid input and 404 for missing paths.

- Credits hint says "management key" instead of the env var name so no OPENROUTER string ships in the client bundle.

## 2026-10-20 - Review follow-ups

- Tab normalization runs `inputForSubmit` on submit and server side, and history thumbs render only the record's tab.
- Boot reconcile no longer expires by age. A job expires only on OpenRouter expired, 404, or a passed `expires_at`.
- Local API guard requires matching Host, Origin, Sec-Fetch-Site and a JSON content type, or answers 403/415.
- Model picker options come from `MODEL_PRESETS`, and prices use live SKU rates with a saved fallback.
- Price shows in the Resolution popover, the model picker and the Generate button. Discounted prices show the struck list price and the percent off.
- Adding a video reference clamps duration to the preset combined input plus output limit, with a toast.
- Known literal labels in stored or pasted prompts become mention chips.
- Picker thumb URLs carry a file stamp version so replaced uploads refetch their thumb.
- Upload delete removes the file and every generation link that references it.
- Global CSS removes focus outlines. Keyboard state relies on hover/focus styling instead.

## 2026-10-20 - History zoom proportions

History zoom uses the supplied sizes as proportions of the row width, measured at a 1518px reference row. List media is 16:9, details fills the remaining width, and rows keep the same height as the media. Grid keeps a fixed column count per step and scales tile width without rewrapping.

| Slider | List video | List details | Grid tile |
| --- | --- | --- | --- |
| 1 | 604px (604x340) | 902px | 172px x 8 |
| 2 | 710px (710x399) | 796px | 200px x 7 |
| 3 | 830px (830x467) | 840px | 252px x 6 |
| 4 | 980px (980x551) | 524px | 286px x 5 |
| 5 | 1132px (1132x637) | 374px | 362px x 4 |
| 6 | 1270x714px | 240w x 714h | 486px x 3 |

Slider 3 totals 830 + 840 = 1670px, more than the 1518px reference. Media keeps the 830px share and details takes the remainder so the row never overflows.

The details panel stops shrinking at 240px wide and 280px tall. Below that the media box caps at the remaining row width and stays 16:9, so narrow windows keep the same layout without horizontal overflow. Media aligns to the top when it is shorter than the details panel.

## 2026-10-21 - Tauri shell with a Node sidecar

Decision: the desktop app is a Tauri shell that spawns the existing Next.js server as a Node sidecar.

Why: the UI, routes and jobs already exist and run on Node. Tauri gives a small native shell, dialogs, notifications and keychain access without reimplementing the app.

Rejected: a full Rust rewrite, and Electron (larger runtime and a second browser stack).

## 2026-10-21 - Browser and desktop modes

Decision: the same server runs in browser mode for development and desktop mode for users.

Why: development stays fast with hot reload and no packaging, while users get a native window, keychain and no terminal.

Rejected: desktop only (slow iteration), browser only (no keychain or native dialogs).

## 2026-10-21 - Fixed desktop port

Decision: the desktop server uses 47821 by default, saved in `desktop.json`. A busy port falls back to a free one and is saved.

Why: a predictable origin makes the session URL, navigation guard and dev tooling simple.

Rejected: a random port every launch.

## 2026-10-21 - Secrets stay on the server, bridge in desktop

Decision: keys are read and written only by the server. In desktop mode the server asks the Rust shell over stdin/stdout instead of calling the keychain itself.

Why: the webview never receives keys. Moving keychain calls to the signed app avoids a second Dock icon and stops a waiting prompt from freezing the Node event loop.

Rejected: keychain access from the webview, and direct Node keychain access in desktop mode.

## 2026-10-21 - Positional prompt slots

Decision: prompts store `@Image N`, `@Video N` and `@Audio N`, numbered by reference order per kind.

Why: readable, editable, and stable when a reference is inserted earlier. Loose forms convert on submit.

Rejected: storage ids inside the prompt (unreadable and tied to file records).

## 2026-10-21 - R2 content addressing

Decision: remote objects use `refs/<sha256><ext>`, with `putOnce` for de-duplication.

Why: the same file used twice shares one object, keys are stable across renames, and an existing object can be reused instead of re-uploaded.

Rejected: per-upload keys (duplicates, stale objects on retry).

## 2026-10-21 - Source-map pruning and the hoisted linker

Decision: stage the server without `.map` files, and use `nodeLinker: hoisted` for pnpm.

Why: maps are useless in the packaged app and cost size. Native modules (`sharp`, `@napi-rs/keyring`) must resolve from the staged tree, the hoisted linker makes that check deterministic.

Rejected: shipping source maps, and npm-style per-package resolution that hides native modules inside `.pnpm`.

## 2026-10-21 - dnd-kit for reference reordering

Decision: `@dnd-kit/*` is installed and used to reorder references.

Why: accessible keyboard and pointer sorting without hand-rolled drag math.

Rejected: custom pointer handlers and HTML5 drag events.

## 2026-10-21 - Own GPL ffmpeg build

Decision: build ffmpeg from pinned sources with the repo profiles, CI builds each target, and the three verified source archives are attached to every release.

Why: `ffmpeg-static` ships `--enable-nonfree` components, so it cannot be redistributed. The own build stays GPL-only and passes `verify.sh`.

Rejected: `ffmpeg-static` for releases, and any build with `--enable-nonfree`.

## 2026-10-21 - sharp stays

Decision: keep sharp for image work.

Why: ffmpeg does not cover mozjpeg, the alpha check, ICC conversion or EXIF rotation.

Rejected: replacing sharp with the ffmpeg sidecar.

## 2026-10-21 - One file per model

Decision: one file per model under `src/core/presets/<family>/`, with shared settings in `family.ts`.

Why: a model's limits and prices stay in one place, and the contract test can check them. No code outside `src/core/presets` branches on a preset id, slug or family.

Rejected: a central switch over preset ids and per-model conditionals in features.

## 2026-10-21 - Base64 images for every preset

Decision: send base64 images for all four presets. Real runs on 2026-10-21 proved every preset accepts them.

Why: base64 works without R2, and the URL transport stays an optional path for video and audio.

Rejected: requiring R2 for image references.

## 2026-10-21 - Seedance content policy

Decision: Seedance blocks realistic faces. The error text says so when it happens, and the hint points at "another model" without naming one.

Why: the provider rejects those references, so the app should explain the rejection and offer a way out that keeps models independent.

Rejected: retrying the same references on Seedance.

## 2026-10-21 - 4K reference ladder

Decision: reference images use a 4096 px ladder, one step per request, under the 64 MB request budget.

Why: the provider limit and the app's own request cap stay in one plan, so validation can reject an oversized request before submit.

Rejected: upscaling every reference to 4K.

## 2026-10-21 - Raw provider errors, translated at render

Decision: store provider error text raw on the record and translate it at render time in `core/provider-errors.ts`.

Why: the raw text stays available for Details and Copy, and table fixes apply to older records without a migration.

Rejected: rewriting stored errors at write time.

## Deferred on purpose

| Item | Why not now | Bring it back when |
| --- | --- | --- |
| one owner for prompt conversion | high risk, small gain | a prompt conversion bug shows up |
| `p-queue` / `p-limit` | shutdown is done and tested, a rewrite adds risk there | queues need new behavior (priorities, pause per type) |
| `aws4fetch` | saves about 1.5 MB, R2 code works | the AWS SDK causes a real problem |
| `cmdk` model picker | 4 models | more than about 10 models |
| `react-hook-form` | one small form | a second real form appears |
| Virtual scroll (`@tanstack/react-virtual`) | content-visibility covers expected history sizes | history passes about 1,500 items or memory grows after deep scrolling. Spec: list with `measureElement`, grid virtualized by rows from width and zoom, load next page within 5 rows of the end, `scrollToIndex` for jump-to-item, players stop when scrolled out |
| Developer ID signing and notarization (macOS), code signing (Windows) | costs money. Until then the required macOS xattr step stays in the install docs | you publish beyond friends, or keychain prompts after updates get annoying |
| Auto-update (`tauri-plugin-updater`) | needs a signing key and a hosted `latest.json` | more than a few users |
