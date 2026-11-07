# Development

## 1. Requirements

| Tool | Version |
|---|---|
| Node | 24 (repo pins 24.22.1 in the desktop build) |
| pnpm | 10 or newer (repo pins 12.14.0) |
| Rust | stable via [rustup](https://rustup.rs), 1.90 or newer for the desktop app |
| Xcode Command Line Tools | macOS desktop builds |
| zstd | 1.5 or newer, packs the desktop server archive |

## 2. First run

```bash
pnpm install
cp .env.example .env.local
```

Set `OPENROUTER_MOCK=1` in `.env.local` for local work, then:

```bash
pnpm dev
```

The dev server binds to 127.0.0.1:3000. Data goes to `~/.unplatform-ai` unless `STORAGE_ROOT` overrides it.

### Run in the browser

Every server start prints its session URL as its own block:

```text
[unplatform-ai] open http://127.0.0.1:3000/session#t=<token>
```

Open that link once. It sets the session cookie, and the page then loads at `/`. The token is stored at `$STORAGE_ROOT/browser-session` with mode 0600 and reused across restarts, so the same cookie keeps working after `pnpm dev` restarts. Opening `http://localhost:3000/` redirects to `127.0.0.1`, where the cookie lives.

Use `STORAGE_ROOT` to keep a separate dev data root:

```bash
STORAGE_ROOT=~/dev/unplatform-ai-data pnpm dev
```

The desktop app and `pnpm dev` both use `~/.unplatform-ai` by default and share the instance lock. The second one exits with code 75 by design, so quit the other first or point one at its own `STORAGE_ROOT`.

## 3. Scripts

| Script | Action |
|---|---|
| `pnpm dev` | Next dev server on 127.0.0.1 |
| `pnpm build` | Production build, standalone output |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier, writes |
| `pnpm format:check` | Prettier, check only |
| `pnpm test` | Vitest, all suites, once |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm deps` | dependency-cruiser over `src` |
| `pnpm deps:graph` | Write the dependency graph to `docs/deps.mmd` |
| `pnpm knip` | Unused files, exports and dependencies |
| `pnpm desktop:prepare` | Build and stage the server, Node and ffmpeg sidecars |
| `pnpm desktop:dev` | Tauri window against the dev server, no sidecar |
| `pnpm desktop:build` | Installers for the current platform: dmg on macOS, NSIS on Windows, AppImage, deb and rpm on Linux |
| `pnpm ffmpeg:build` | Build the pinned GPL ffmpeg into the local cache |
| `pnpm node:build` | Build the small-ICU Node sidecar into the local cache |
| `pnpm notices` | Regenerate npm notices, copy notices and LICENSE into resources |
| `pnpm size:report` | Print the bundled app size report and check the budget |
| `pnpm size:baseline` | Regenerate `scripts/size-baseline.json` from the current bundle |
| `pnpm smoke` | Run the staged server smoke test |
| `pnpm tauri` | Pass a command to the Tauri CLI |

## 4. Mock modes

| Variable | Effect |
|---|---|
| `OPENROUTER_MOCK=1` | Local timeline. Pending for 3 s (`MOCK_QUEUE_MS`), in progress for 6 s (`MOCK_GENERATE_MS`), then a locally generated video. No API key needed and no cost. |
| `REMOTE_MOCK=1` | Local R2 replacement, only honored together with mock OpenRouter. Links point at the local server. |
| `REMOTE_MOCK_MBPS` | Throttles mock uploads, default 20. |
| `REMOTE_MOCK=fail` | Every mock upload fails. |
| `CUSTOM_ENDPOINT_MOCK=1` | Skips the custom endpoint upload network and returns refs for the file hashes. |
| `[fail]` in the prompt | Mock job ends as failed. |

Mock mode keeps the Test button enabled without stored keys.

## 5. Adding a model

1. Find the provider docs and the OpenRouter model id. Check `/api/v1/videos/models` for `supported_*` fields and `pricing_skus`.
2. Same family as an existing model: add `src/core/presets/<family>/<model>.ts` with only what differs from `family.ts`. New family: add `src/core/presets/<family>/family.ts` with references, `referenceLimits` for every media kind it accepts, `errors`, `icon`.
3. Add it to `VIDEO_PRESETS` in `src/core/presets/index.ts` (the order is the picker order).
4. Write one or more bindings in priority order. The first binding whose provider is configured wins.

   ```ts
   bindings: [
     {
       provider: 'openrouter',
       modelId: 'alibaba/wan-3.0',
       pricing: {
         kind: 'perSecond',
         unit: 'usd',
         skuRules,
         tiers,
         fallback,
         minBillableSec,
         referenceVideoFactor,
       },
       transport: { image: 'base64', video: 'auto', audio: 'auto' },
     },
   ]
   ```

5. `skuRules` is ordered. Each rule has `when` conditions (`hasVideoInput`, `audio`, `hasTier`) and a `key` where `{resolution}` and `{tier}` are replaced. The first matching rule wins. `tiers` maps a resolution to its SKU suffix, for example `1080p` to `_1080p`. `fallback` needs a rate for every key the rules can produce.
6. Put a source link in a comment next to every limit, and in the commit message.
7. `pnpm vitest run tests/presets-contract.test.ts`. It checks defaults, duration options, sizes, pricing keys, reference limits and the error table.
8. After adding or changing a preset, run `LIVE_CATALOG=1 corepack pnpm vitest run tests/catalog-live.test.ts`. A red weekly run means the presets drifted from the live OpenRouter catalog.
9. One real-key run with a prompt, then one with each reference kind. Record anything learned (for example `promptOptional`, the billing floor) in the preset with the date.
   Never branch on a preset id outside `src/core/presets`. Add a preset field instead.

### Image models

1. Read the OpenRouter image model page and live `/api/v1/images/models` data. Check the supported parameters and the resolution or quality SKUs.
2. Same family as an existing model: add `src/core/presets/image/<family>/<model>.ts` with only what differs from `family.ts`. New family: add `src/core/presets/image/<family>/family.ts` with shared controls, reference limits, errors and icon.
3. Add the preset to `IMAGE_PRESETS` in `src/core/presets/image/index.ts` (the order is the picker order).
4. Put the source and date next to every price and every limit.
5. Run `pnpm vitest run tests/image-presets.test.ts tests/presets-contract.test.ts`.
6. Update the image models table in the README. `tests/docs.test.ts` checks it against `IMAGE_PRESETS`.

Image bounds: `IMAGE_COUNT_MAX` caps images in one request, `IMAGE_SUBMIT_PARALLEL` caps parallel submit calls, and image jobs use `IMAGE_MAX_ACTIVE`. Video jobs use `MAX_ACTIVE_JOBS`, so the two kinds never share a cap.

## 6. Adding a video provider

1. Add the id to `VIDEO_PROVIDER_IDS` in `src/core/providers/types.ts`.
2. Add one descriptor in `src/core/providers`, then list it in `VIDEO_PROVIDERS` in `src/core/providers/registry.ts`. The descriptor holds the label, secret fields, required secrets, links and HTTP rule table.
3. Add one adapter under `src/server/providers/<id>` with a factory that returns `VideoProvider` from `src/server/providers/types.ts`. Implement submit, poll, content, account, pricing, model list and connection test.
4. Classify every failure as `ProviderError` with a `ProviderErrorKind`. Jobs branch only on `kind`, never on HTTP status or provider name.
5. Register the factory in `FACTORIES` in `src/server/providers/registry.ts`.
6. The contract is `VideoProvider`. Add one mapping case per kind to `tests/provider-error-mapping.test.ts` and the catalog states to `tests/model-catalog.test.ts`.
7. Mock mode returns the mock adapter from the registry. Records keep the real provider id.

## 7. Adding object storage

1. Add the id to `STORAGE_PROVIDER_IDS` in `src/core/providers/types.ts`.
2. Add one descriptor in `src/core/providers`, then list it in `STORAGE_PROVIDERS` in `src/core/providers/registry.ts`.
3. Add a config function that returns `S3StoreConfig` from secrets: `endpoint`, `region`, `bucket`, `accessKeyId`, `secretAccessKey`. Return null when one is missing.
4. Select it in `src/server/storage/registry.ts` with `createS3Store(config)`. A store that is not S3 implements `ObjectStore` directly.
5. Add the secret names to `SecretName` so Settings renders the descriptor fields.
6. Test the store through `tests/remote-inputs.test.ts` and the mock store.

### Storage, downloads and thumbnails

- The R2 cap counts the listed `refs/` objects when the store can list, else the tracked upload sizes. The sweep removes unused keys after `REMOTE_UNUSED_DAYS` and untracked objects older than `REMOTE_LINK_TTL_SEC`.
- The cap check and the put run under one `remoteCap` lock.
- Downloads call the authenticated content endpoint with `record.job.id`, then fall back to `job.urls` when that call fails.
- A failed download can be retried from the record while the provider copy is valid, through `POST /api/generations/{id}/download`. It never submits again.
- `RetryImage` retries a thumb twice, then shows the placeholder for its kind.
- The thumbs route answers `private, no-cache` with a strong ETag and 304 on a matching `If-None-Match`.
- Deletes go through `removeOwnedFile`, which refuses anything outside `STORAGE_ROOT` or with a foreign basename.

## 8. Environment variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | Required for real generation |
| `OPENROUTER_MANAGEMENT_KEY` | Optional, adds balance to the credits pill |
| `OPENROUTER_MOCK` | `1` turns on the mock provider |
| `STORAGE_ROOT` | Data folder, default `~/.unplatform-ai` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | R2 token secret |
| `R2_BUCKET` | Bucket name |
| `CUSTOM_ENDPOINT_TOKENS` | Custom endpoint auth tokens, stored as JSON |
| `CUSTOM_ENDPOINT_MOCK` | `1` skips the custom endpoint upload network |
| `REMOTE_MOCK` | Local R2 mock, `1` or `fail` |
| `REMOTE_MOCK_MBPS` | Mock upload speed |
| `APP_TOKEN` | Session token override for dev and smoke runs. Unset reuses `$STORAGE_ROOT/browser-session` (or mints it) and prints the session URL. |
| `APP_TOKEN_FILE` | 0600 JSON file the desktop shell writes with the token, parent secret and boot nonce. The server reads it once, then deletes it. |
| `UPAI_DESKTOP` | `1` forces desktop mode. The shell normally marks desktop mode with `APP_TOKEN_FILE`. Desktop mode never prints a browser session URL. |
| `PARENT_PID` | Tauri process id, set by Tauri. The server exits when it disappears. |
| `PORT`, `HOSTNAME` | Server bind address |
| `UPAI_SECRETS_BACKEND` | `file` forces the file backend, for debugging keychain issues |
| `UPAI_UPDATE_ENDPOINT` | Updater manifest URL, for packaged rc tests |
| `LIVE_CATALOG` | `1` runs the live OpenRouter catalog test |
| `E2E_SLOW_MEDIA_MS` | Holds `/api/media` responses for the thumb-first paint e2e check |
| `WRITE_IMAGE_PRICE_FIXTURE` | `1` rewrites the image price fixture during the drift test |
| `FFMPEG_PATH` | ffmpeg binary for the dev server and smoke runs |
| `APP_ORIGIN` | Origin used by mock remote links |

Env values override stored keys and are read-only in Settings.

## 9. Tests

Suite layout: `tests/*.test.{ts,tsx}`. Most tests cover `src/core` pure logic, route helpers, repos, locks and secrets with fake backends in the Node environment. Component tests opt in per file with `// @vitest-environment jsdom` and Testing Library.

Run one file:

```bash
pnpm vitest run tests/presets.test.ts
```

Watch mode:

```bash
pnpm vitest
```

`tests/docs.test.ts` checks the README status table, the architecture models and bounds tables, every guide image on disk, both guides linked from the README and from the app, the R2 guide numbers, the app strings quoted in the guides, the trademark disclaimer, and that relative doc links exist. `tests/docs-images.test.ts` keeps the R2 guide images in reading order. `tests/provider-links.test.ts` checks every provider link against the opener allowlist in `src-tauri/capabilities/default.json`.

## 10. Lint and dead code

`pnpm lint` runs ESLint. `pnpm knip` reports unused files, exports and dependencies, and is part of the gate and CI.

`.github/workflows/ci.yml` runs on pushes to `releases`, on pushes to version branches (`[0-9]*.[0-9]*.[0-9]*`) and on pull requests. Concurrency group `ci-<ref>` cancels a superseded run. It calls `.github/workflows/checks.yml` (typecheck, lint, deps, format, knip, test, build) and runs a `workflows` job that lints the pipeline itself. `.github/workflows/audit.yml` runs `pnpm audit --prod --audit-level high` and `cargo audit` on a weekly schedule and on pull requests that touch `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml` or `src-tauri/Cargo.lock`, where they block. Tag pushes go to the release workflow, which runs the same checks once for `v*-rc.*`.

The `workflows` job runs actionlint through its pinned Docker image, shellcheck over `.github/scripts/*.sh`, `scripts/ffmpeg/*.sh`, `scripts/node/*.sh` and `scripts/generate-header.sh`, and zizmor 1.31.1 at `--min-severity medium --min-confidence high`. actionlint also shellchecks every `run:` block. `.github/workflows/catalog-drift.yml` runs the live catalog test weekly.

Dependabot opens one grouped monthly pull request for npm, cargo and GitHub Actions against `releases`, with `open-pull-requests-limit: 1` and the `dependencies` label. Semver-major updates are ignored. `pr-version` never merges those pull requests: it passes, adds the `apply-on-next` label, and keeps one reminder comment that says to apply the updates on the next version branch. Branch protection can optionally require the `apply-on-next` check so an unlabeled Dependabot pull request cannot merge. The notices check, e2e and audit skip a Dependabot pull request into `releases`. CodeQL default setup runs weekly on actions, JavaScript/TypeScript and Rust.

## 11. Code shape rules

- Keep files near 200 lines or less. Split by component or job, not by squeezed formatting.
- One exported component per file. The file name matches the main export. Private subcomponents stay in the same file only when they exist for one caller.
- Components take one `props` object: `function Row(props: RowProps)`, then `const { record } = props` on the first line.
- Functions and hooks with three or more inputs take one `params` object. Two or fewer may stay positional.
- Named exports. A default export only where Next requires it (`page.tsx`, `layout.tsx`).
- Import direction: `core` imports nothing from `server`, `features` or `lib`. Only `lib/platform/desktop.ts` imports `@tauri-apps/*`.
- One type per API shape lives in `src/core`. Data from outside is parsed with zod, and types come from `z.infer`.
- Never branch on a preset id, slug or family outside `src/core/presets`. Add a preset field instead.
- No focus rings. Keyboard focus uses the `:focus-visible` hover UI, never `focus-visible:ring-*`.
- Mock first: `OPENROUTER_MOCK=1` for generation work, `REMOTE_MOCK=1` for storage work.

## 12. Viewers

- `MediaStage` (`src/ui/MediaStage.tsx`) draws one media area with a blurred thumb or a hashed gradient backdrop, optional arrow nav and a `toolbar` slot that appears on hover.
- `useChainKeys` (`src/lib/use-chain-keys.ts`) maps left and right arrows to previous and next. `lib/dialog-keys.ts` lets a key act only inside the topmost `[role="dialog"]` or `[role="alertdialog"]`, and ignores inputs, textareas, selects, editors, sliders and the alt, ctrl and meta modifiers.
- The history details viewer keeps its record in `features/history/list/history-viewer-store.ts` (`selectedId`, `open`, `close`, `navigate`, not persisted). `closeViewers()` closes the preview and that viewer.
- `ZoomLayer` (`src/ui/ZoomLayer.tsx`) adds wheel, pinch and key zoom to images only. Its scale, offset and fit math lives in `zoom-math.ts`.
- A video player starts after a half second stay (`AUTOPLAY_DELAY_MS`) and shows its poster until playback starts.

## 13. Picker

- `features/media-picker/picker/store.ts` holds one request: kinds, optional extensions and one of two modes. `toggle` takes `useSelectedIds`, `useUploadsById`, `canAdd` and `onToggle` from the opener, reads selection from the generator and stays open. `pick` takes only `onPick` and closes after the pick.
- No local selection and no Add button. A file click runs the opener's action.
- Reference limits come from `features/generator/reference-rules.ts` (`referenceRoom` and `referenceBlockReason`).
- Folder files link on click and match an attached upload by its `target` through `core/folder-match.ts`.
- `DockedPanel` docks the picker beside the generator anchor at 900 px and up, and shows a centered modal below that.

## 14. Desktop build

`pnpm desktop:build` builds the installers for the current platform only: dmg on macOS, NSIS on Windows, AppImage/deb/rpm on Linux.

On Linux the AppImage needs FUSE 2. Ubuntu 22.04 or Debian 12: `sudo apt install libfuse2`. Ubuntu 24.04 or newer: `sudo apt install libfuse2t64`. Install exactly that package, not `fuse`, which replaces `fuse3`. Without FUSE, run `./unplatform-ai-*-linux-x64.AppImage --appimage-extract-and-run`.

`pnpm desktop:prepare` runs a Next build, then `scripts/prepare-desktop.mjs`:

1. Copies `.next/standalone` and `.next/static` into `src-tauri/resources/server`, skipping env files, docs, sources, tests and build caches.
2. Removes traced ffmpeg binaries. Desktop uses the separate ffmpeg sidecar.
3. Prunes the staged server in groups and prints the size of each: source maps, type declarations, docs (license and notice files stay), `test`, `tests`, `__tests__`, `docs`, `examples` and benchmark folders, build traces (`.nft.json`, `.DS_Store`, `.tsbuildinfo`), native packages for other platforms, and the unused Next `@vercel/og`, edge runtime, MSW, comment-json, tar and experimental runtime files. The smoke run proves the remaining chunks load. Root images, lockfiles, configs and CI/IDE entries are deleted too. Only `package.json`, `server.js`, `.next`, `node_modules`, `public` and license notices stay at the root. `next.config.ts` also excludes the same paths from tracing, so they never reach `.next/standalone`.
4. Uses `NODE_BINARY` or the custom small-ICU cache first, otherwise downloads official Node 24.22.1 and verifies `SHASUMS256-v24.22.1.txt`.
5. Copies a custom ffmpeg build and stages it with the Rust target triple. `FFMPEG_BINARY` wins, then the cache path `~/.cache/unplatform-ai-build/ffmpeg/<version>-<profile>/<triple>/ffmpeg-<triple>`, read from `scripts/ffmpeg/versions.env` and `FFMPEG_PROFILE` (default `minimal`). The `ffmpeg-static` fallback needs `ALLOW_NONFREE_FFMPEG=1`, CI requires `FFMPEG_BINARY`. Custom builds run `scripts/ffmpeg/verify.sh`.
6. Reads `ffmpeg -buildconf`, prints the chosen path, size and license flags, and fails on `--enable-nonfree`. Custom builds are GPL only, so releases use them.
7. Copies each native platform package (`@img/sharp-*`, `@napi-rs/keyring-*`) whole into the staged tree so Windows libvips DLLs stay beside `sharp.node`, on macOS, ad-hoc signs every Mach-O under the staged server with `codesign --force --sign -`, then runs every `serverExternalPackages` entry and the native package checks from the staged tree.
8. Packs the staged tree as `src-tauri/resources/server-archive/server.tar.zst` with zstd level 19 and writes `server.build-id` from `.next/BUILD_ID`. The app bundle carries those two files instead of `Resources/server/`. On macOS the archive is extracted again in a temp folder and `codesign -v` checks every `.node` and `.dylib`.
9. Prints staged sizes, the archive size and the bytes pruned.
10. Release builds use `[profile.release]` in `src-tauri/Cargo.toml`: `codegen-units = 1`, `lto = true`, `opt-level = "s"` and `strip = true`. Panic unwinding stays on so the hook keeps writing to `desktop.log`.

`pnpm notices` regenerates the npm section of `THIRD_PARTY_NOTICES.md` from `pnpm licenses list --prod --json`, then copies it and `LICENSE` into `src-tauri/resources`. `prepare-desktop.mjs` copies `licenses/` into `src-tauri/resources/licenses`. `desktop:prepare` runs both.

`pnpm smoke` runs `scripts/smoke-server.mjs` against the staged target: starts the sidecar with a temp `STORAGE_ROOT`, opens a session, answers the @@upai-secrets bridge in memory (no file-backend override on macOS or Windows), links a fixture image, submits a Wan 3.0 frames job in mock mode, fetches the video and thumb, then shuts down and checks `server.lock` is gone. Run it after `pnpm desktop:prepare`. Pass `--target <triple>` to test another staged platform. The file backend itself is Linux only.

Sidecars: `unplatform-ai-server-<target-triple>` is the Node runtime, `ffmpeg-<target-triple>` is ffmpeg. Every platform lists both in `bundle.externalBin` from `tauri.conf.json`, so Tauri copies them beside the app binary and ad-hoc signs them on macOS. The shell injects `PORT`, `HOSTNAME=127.0.0.1`, `APP_TOKEN_FILE`, `PARENT_PID` and `FFMPEG_PATH`, always spawns the `unplatform-ai-server` sidecar and points `FFMPEG_PATH` at the bundled ffmpeg.

Desktop does not run the server from the app bundle. On first launch it streams `Contents/Resources/server.tar.zst` into `~/.unplatform-ai/runtime/<app version>` under a hidden `.staging-<pid>` folder, then renames it into place. The archive paths are checked (no absolute paths, no `..`, no symlink that leaves the target) and the staging folder is removed when extraction fails. A `.upai-build` stamp holds the `Contents/Resources/server.build-id` value, the server build id alone. Later launches reuse the copy only when the stamp matches, so a same-version rebuild restages it. The stamp is written last, so an interrupted extraction never counts as done. The sidecar runs with that folder as its cwd, so Next writes `.next/cache` there and the bundle resources stay untouched. The ad-hoc signature seal stays valid after running and quitting, and the native files keep their Mach-O signature through tar and extraction. A version bump uses its own folder and removes older runtime folders after readiness.

The bundle sets `LSUIElement` so the sidecar gets no Dock tile. Next sets `process.title`, which makes LaunchServices re-register the Node child under the app bundle id, agent bundles default to `UIElement`. `main.rs` restores `Regular` for the shell, so only one Dock entry remains.

That policy flip can leave WebKit treating the webview as inactive, which on macOS 14+ throttles rendering to a few fps. Every window is built with `BackgroundThrottlingPolicy::Disabled` and the app activates on launch, so the UI stays at full frame rate while another app is frontmost.

WKWebView still caps page rendering near 60 fps on ProMotion. After the window is built, `server/boot.rs` calls `fps::disable_60fps_cap` through `with_webview` and turns off the private `PreferPageRenderingUpdatesNear60FPSEnabled` feature in `WKPreferences`, which unlocks up to 120 fps. The call is wrapped in `catch_unwind` and writes `120 Hz page rendering ...` to `desktop.log`. Every private selector is checked first, so a missing one leaves rendering at 60 fps instead of crashing.

The private API is direct-distribution only. It is not App Store safe.

Entitlements in `src-tauri/Entitlements.plist`:

| Entitlement | Why |
|---|---|
| `allow-jit` | JavaScriptCore needs JIT for the webview |
| `allow-unsigned-executable-memory` | JIT code pages on hardened runtime |
| `disable-library-validation` | Loads the staged server and native modules signed ad hoc |

Signing is ad hoc (`signingIdentity: "-"`). Rebuilds count as a new program to macOS, so Keychain prompts can return.

Measured on 2026-11-02, macOS arm64: DMG 34.1 MiB (35,749,578 bytes, ULMO), app bundle 82.5 MiB (86,530,330 bytes), updater archive 40.6 MiB (42,591,629 bytes). Inside the app: server archive 11.2 MiB (11,699,059 bytes), shell 8.8 MiB (9,232,080 bytes), Node sidecar 51.0 MiB (53,512,352 bytes) and ffmpeg 9.4 MiB (9,837,024 bytes). First launch extracts the server to 44.0 MiB (46,187,444 bytes), so the install total is 126.6 MiB (132,717,774 bytes). The Node sidecar is the amaro-off small-ICU 24.22.1 build (`icu_small true`, `node_use_amaro false`). `pnpm desktop:build` converts the DMG to ULMO and packs `.app.tar.gz` with `gzip -9` before the size report; the release workflow re-signs the archive when a signing key is set.

Extracting the archive with `tar --zstd` into fresh temp dirs took 0.28 s, 0.27 s and 0.26 s (warm cache). This is an extraction proxy, not a full first-launch measurement.

`pnpm size:report` prints the size of each bundled part, the server archive, the extracted runtime, the app total, the install total (`appTotal + runtimeTotal`), the DMG and the updater archive, and fails when the install total passes the baseline by more than 5 percent. `scripts/size-baseline.json` holds the committed baseline, and `pnpm size:baseline` regenerates it. The release build uploads the report as an artifact. The 0.4.0 budget is macOS-only and is computed from `installTotal`.

In 0.4.0 the postbuild compression and the size report run on macOS only. On Windows and Linux `pnpm desktop:build` skips both steps and exits 0.

Build per architecture. arm64 builds on Apple Silicon. x64 needs an Intel Mac, or an x64 Node and matching native modules.

## 15. Own ffmpeg build

- `pnpm ffmpeg:build` builds the redistributable ffmpeg for this machine into `~/.cache/unplatform-ai-build/ffmpeg/<version>-<profile>/<triple>/`. `pnpm desktop:build` picks it up from there.
- ffmpeg 9.0.2 with the `minimal` profile lands in `~/.cache/unplatform-ai-build/ffmpeg/9.0.2-minimal/<triple>/ffmpeg-<triple>`. The minimal build has x264, AAC, PNG, MJPEG, WebP, ProRes, DNxHD, MPEG-4, AV1 and the filters the app uses, and no nonfree components.
- Versions and SHA-256 sums: `scripts/ffmpeg/versions.env`. Flags: `scripts/ffmpeg/profile-*.txt`. Any change under `scripts/ffmpeg/` changes the GHCR key, so CI rebuilds and pushes that sidecar unless the key already exists.
- Source archives come from the GHCR package `ghcr.io/jefoce/unplatform-ai-sources` (tag `ffmpeg-<version>-x264-<first8>-zlib-<version>`), warmed by the Linux CI job. ffmpeg.org, the x264 GitLab archive and zlib (fossils, then the GitHub mirror) are fallbacks. The pinned SHA-256 stays the authority.
- `FFMPEG_PROFILE=minimal` is the default. Build it with `bash scripts/ffmpeg/build-unix.sh --profile minimal`; `FFMPEG_PROFILE=full` selects the large profile.
- `FFMPEG_BINARY=<path>` uses a specific binary. CI always sets it.
- `scripts/ffmpeg/verify.sh <binary>` checks the license flags, the codecs, the filters and every command the app runs, using `tests/fixtures/media/`. On macOS it also reads `LC_BUILD_VERSION` and fails when `minos` is greater than 13.0. macOS arm64 needs Xcode >= 16.1.
- Windows cross-builds on Linux with `bash scripts/ffmpeg/build-windows.sh` and mingw-w64. Add `--prepare-only` on macOS or Linux to download, verify and unpack the three archives without cross-compiling.
- `ALLOW_NONFREE_FFMPEG=1` falls back to `ffmpeg-static` for local builds only. The result is not redistributable. CI refuses it.
- `pnpm dev` uses `ffmpeg-static` from `node_modules`. `FFMPEG_PATH` overrides it.
- Pass `--sources <dir>` to copy the three verified source archives out for release assets. The script also writes `buildconf.txt` next to the binary. Windows cross builds run the exe under Wine to write the real `buildconf.txt`, if Wine is missing locally the file is skipped with a warning.

Measured on macOS arm64: minimal 9.4 MiB, full 22.1 MiB, `ffmpeg-static` fallback 43.5 MiB.

## 16. Own Node build

`pnpm node:build` runs `scripts/node/build-unix.sh` and builds Node 24.22.1 with `small-icu`, no npm, no corepack and no Amaro. The result lands in `~/.cache/unplatform-ai-build/node/24.22.1-small-icu/<triple>/unplatform-ai-server-<triple>`, and `prepare-desktop.mjs` uses it when present. Source is the official `.tar.xz`, checked against `NODE_SHA256` in `scripts/node/versions.env`. The build enables LTO and `-Os`; on macOS arm64 that drops the binary from 65.0 MiB to 54.7 MiB, and `--without-amaro` brings it to 53,493,448 bytes (51.0 MiB), 53,511,584 bytes after ad-hoc signing, with startup moving from a 415 ms median to 437 ms (5.3 percent).

CI uses GHCR tags keyed by the scripts/node hash, target triple and runner image: a hit is pulled and verified, a miss is built and pushed. `actions/cache` only warms the build work dir.

The Windows build unpacks and compiles in a short work dir (`D:\nb`, or `C:\nb` without a `D:` drive) because MSBuild FileTracker rejects paths over 260 characters. Override it with `NODE_BUILD_WORK`, keeping the path at 10 characters or fewer. The download archive and the final binary stay in the normal cache.

`pwsh ./scripts/node/build-windows.ps1 -PrepareOnly` downloads, verifies and unpacks the tarball without compiling, on Windows or another host. Other hosts use `/tmp/nb` as the work dir unless `NODE_BUILD_WORK` overrides it.

For size experiments, `NODE_CONFIGURE_EXTRA` adds space-separated flags to `./configure`. Every token must start with `--` and appear in `./configure --help`, otherwise the build stops before compiling. `NODE_OUTPUT_SUFFIX` appends to the cache folder and binary name, so `-z7` lands in `24.22.1-small-icu-z7/unplatform-ai-server-<triple>-z7`. `verify.sh` still runs its full checks on the result.

The build keeps `node:inspector`: Next 16 requires it at startup, so `--without-inspector` is rejected. `--without-sqlite` only links together with `--without-inspector`, which is rejected anyway. `--v8-lite-mode` is smaller but rejected: `/api/generations` mean latency rose 21.5 and 29.6 percent over two 50-request runs, above the 15 percent limit.

The macOS build needs Xcode >= 16.1 (Apple LLVM >= 17) per Node's `BUILDING.md`. `CFLAGS`, `CXXFLAGS` and `LDFLAGS` add `-mmacosx-version-min=13.0` because `common.gypi` hardcodes 13.5 and the user flags must win.

`bash scripts/node/verify.sh <binary>` checks the version, small ICU, `Intl.DateTimeFormat`, the linked libraries and, on macOS, the `LC_BUILD_VERSION` `minos`, which must be 13.0. Add `--smoke` to run `desktop:prepare` and `pnpm smoke` against it.

Without a cached build, `prepare-desktop.mjs` downloads official Node 24.22.1, verifies `SHASUMS256-v24.22.1.txt` and prints a warning. CI requires `NODE_BINARY` unless `ALLOW_OFFICIAL_NODE=1`. CI caches the built binary by `hashFiles('scripts/node/**')`.

Measured on 2026-11-01, macOS arm64: amaro-off small-ICU binary 51.0 MiB (53,511,584 bytes) after ad-hoc signing, against 116.9 MiB for official Node 24.22.1.

The first build compiles Node from source and is slow. Later runs reuse the cached binary.

### Local builds on a RAM disk

`UPAI_BUILD_WORK_DIR` moves extraction, object files and links off the SSD. Both build scripts use `$UPAI_BUILD_WORK_DIR/<tool>/<version>-<flags>/`, and only the stripped binary and its license or buildconf land in `~/.cache/unplatform-ai-build/`. Source archives stay in the SSD cache.

```bash
UPAI_BUILD_WORK_DIR=/Volumes/ram/upai-build CARGO_TARGET_DIR=/Volumes/ram/upai-build/cargo pnpm desktop:build
```

The script creates the folder when it is missing. The Node work tree needs 25 GiB (measured on macOS arm64), ffmpeg needs 186 MiB. An unwritable or too small directory stops the build after printing its free space and the expected need. The work subfolder is deleted after the binary is copied, and `--keep-work` keeps it. Without the variable the scripts keep their old layout and CI uses the runner disk.

A RAM disk loses its contents on reboot by design. Re-create the volume and run the command again after a restart.

## 17. Debugging

### Stale builds

Before reporting a UI bug or checking a UI change:

```bash
rm -rf .next
pnpm dev
```

For the desktop app also clear the old bundle before `pnpm desktop:build`:

```bash
rm -rf src-tauri/target/*/release/bundle
```

If `bundle_dmg.sh` was interrupted, delete the leftover `rw.*.dmg` next to the bundle.

| Task | How |
|---|---|
| Server log | `~/.unplatform-ai/logs/server.log`, rotated at 5 MB into `.log.1` to `.log.3` |
| Health | `curl http://127.0.0.1:47821/api/health` shows app, pid, desktop and ready |
| Run the packaged server by hand | See below |
| Open a desktop session | Open `http://127.0.0.1:47821/session#t=test` |
| Kill a stuck sidecar | Quit the app, then `pkill -f unplatform-ai-server` |
| Reset the instance lock | Quit every instance, then delete `~/.unplatform-ai/server.lock` |
| Force the file keychain backend | Start the server with `UPAI_SECRETS_BACKEND=file` |
| Linux UI looks transparent or ghosted | WebKitGTK blur, see the `data-os` rule in `globals.css` |
| Port | `desktop.json`, default 47821. A busy port falls back to a free one. |

Run the packaged server without Tauri:

```bash
cd src-tauri/resources/server
PORT=47821 HOSTNAME=127.0.0.1 APP_TOKEN=test \
  ../../binaries/unplatform-ai-server-<target-triple> server.js
```

Then open `http://127.0.0.1:47821/session#t=test`.

## 18. Release checklist

`.github/workflows/release.yml` runs on pushes to `releases`, on `v*-rc.*` tags and on manual `workflow_dispatch` with a `tag` input. A `draft` job creates one draft release before any build. The `ffmpeg` and `node` jobs pull their sidecar from GHCR or build and push it. A `checks` job calls `checks.yml` once in parallel with the sidecar jobs. Build jobs download artifacts (or a reused run), verify sidecars, stage the server, run the smoke test, build installers, rename them `unplatform-ai-<version>-<platform>-<arch><suffix>` and upload them by release id. The checksums job reads ffmpeg sources from GHCR first and from the run artifact second, then uploads `SHA256SUMS.txt` and the archives by release id. On a push to `releases`, the `tag` job creates and pushes `vX.Y.Z` only after every job passed. Every oras push carries `org.opencontainers.image.source` linking the package to this repo.

### Job graph

```text
version -> draft
        -> ffmpeg
        -> node
checks (parallel, checks.yml)
version + draft + ffmpeg + node + checks -> build
build -> checksums
      -> updater-manifest
checksums + updater-manifest -> tag (releases push only)
```

`ffmpeg` and `node` skip when `reuse_sidecars_run_id` or `SIDECARS_RUN_ID` is set. `build` runs only when `checks` passed. It keeps `pnpm test` on each runner because the tests cover Windows paths and secrets backends, and drops the other checks.

### Build installers

"Build installers" runs the repo's pinned `@tauri-apps/cli` through `pnpm tauri build --target <target> --config src-tauri/tauri.release.conf.json`. No third-party action runs the build, so the signing key only reaches the CLI we ship.

`UPAI_PREPARED=1` short-circuits `prepare-desktop.mjs`, which already ran in "Stage server". `tauri.release.conf.json` turns on `createUpdaterArtifacts` and clears `beforeBuildCommand`, so `notices` and `next build` run once, in `pnpm desktop:prepare`, not again inside `tauri build`. Local `pnpm desktop:build` keeps the full `beforeBuildCommand` and stays on the default config.

The ffmpeg job runs "Plan ffmpeg build" (`ffmpeg-plan.sh`) after the GHCR restore and the Linux sources pull. It writes `build` and `out`:

| Restored sidecar | Linux sources | `build` | `out` |
| --- | --- | --- | --- |
| no | any | `true` | `ffmpeg-out` |
| yes | no | `true` | `ffmpeg-rebuild` |
| yes | yes | `false` | `ffmpeg-out` |

A sources-only rebuild writes to `ffmpeg-rebuild`, never over the verified binary and manifest restored from GHCR. "macOS toolchain", "Cache ffmpeg downloads and build", "Linux packages", "Windows buildconf tool" and "Build ffmpeg" run only when `build` is `true`.

### Caches and timeouts

The ffmpeg cache (`~/.cache/unplatform-ai-build/ffmpeg`) restores only when the job builds. The Node cache (`.../node`) restores only on a GHCR miss. The build job's `~/.cache/unplatform-ai-build` cache restores only when no Node artifact exists (`needs.node.result == 'skipped'` and no reuse run), because only then does `prepare-desktop.mjs` download official Node. A GHCR hit skips every cache download.

The build job has a 90-minute timeout, sized for a cold `rust-cache` on Windows: `pnpm install`, the tests, `desktop:prepare`, the smoke test and a release build with `lto = true` and `codegen-units = 1`.

### Composite actions

| Action | Inputs | Does |
| --- | --- | --- |
| `.github/actions/setup-pnpm` | `install` (`true`, `prod`, `false`) | pnpm, Node 24 with the pnpm cache, then a frozen install |
| `.github/actions/sidecar-restore` | `name`, `target`, `runner`, `profile`, `force`, `token` | setup-oras, GHCR login, key, guarded pull, manifest check, `<name>-out`. Outputs `key` and `found` |
| `.github/actions/sidecar-publish` | `name`, `target`, `version`, `profile`, `key`, `force`, `token`, `files` | manifest, guarded push, tar, artifact upload |

Composite actions cannot read secrets, so the token is an input. The build step stays in the job because ffmpeg, Node Unix and Node Windows differ.

### Workflow scripts

Each script takes arguments and runs with `set -euo pipefail`. Expressions reach it through `env:`.

| Script | Arguments |
| --- | --- |
| `checksums.sh` | `build <target> <dist>` or `merge <dist> <sources>` |
| `ffmpeg-plan.sh` | none (`RESTORE_FOUND`, `SOURCES_FOUND`, `TARGET` in the environment) |
| `ffmpeg-sources-tag.sh` | none |
| `ghcr-pull.sh` | `<ref> <dir> <required-file>...` |
| `ghcr-push.sh` | `<ref> <dir> <file>...` (`FORCE` in the environment) |
| `release-draft.sh` | `TAG` and `PRERELEASE` in the environment |
| `release-version.sh` | `TAG_INPUT` and the `GITHUB_*` environment |
| `rename-installers.sh` | `<bundle> <version> <target> <dist>` |
| `sidecar-binary.sh` | `<name> <target> [exe]` |
| `sidecar-key.sh` | `<name> <target> <runner> [profile]` |
| `sidecar-manifest.mjs` | `write <binary> <out> <name> <target> <version> [profile]` or `verify <binary> <manifest>` |
| `sources-manifest.mjs` | `<dir> <tag>` |
| `stage-sidecar.sh` | `<name> <target> <artifact-dir> <out-dir>` |
| `target-runners.sh` | `<target>` |
| `updater-manifest.mjs` | `--version --tag --repo --changelog --pub-date --signatures --out` |
| `upload-release-assets.sh` | `<release-id> <file>...` |

`tests/ci-scripts.test.ts` covers the rename, version, sources tag and ffmpeg plan scripts, plus the GHCR pull flattening, with a fake `oras`. The ffmpeg and Node builds under `scripts/ffmpeg` and `scripts/node` do not change. Any byte there changes a GHCR key.

`ghcr-pull.sh` prints a bare `true` or `false` on stdout, and diagnostics go to stderr. Callers capture it with `found=$(...)` and write `found=$found` to `GITHUB_OUTPUT`, so a hit is never written as `found=found=true`.

### Sidecar artifacts (GHCR)

Release builds pull prebuilt sidecars from the public packages `ghcr.io/jefoce/unplatform-ai-sidecars` and `ghcr.io/jefoce/unplatform-ai-sources` before compiling. Sidecar tags look like `<name>-<target>-<hash16>`, where the hash covers every file under `scripts/<name>` (sorted relative path plus sha256), the target triple, the runner image and the ffmpeg profile (`minimal`, empty for Node). `.github/scripts/sidecar-key.sh <name> <target> <runner> [profile]` prints the key. Sources use `ffmpeg-<FFMPEG_VERSION>-x264-<first8>-zlib-<ZLIB_VERSION>`. Actions cache is ref-scoped and only warms build work dirs.

On a miss the job builds the sidecar, runs its `verify.sh`, writes `manifest.json` next to the binary and pushes the binary, `buildconf.txt` (ffmpeg only) and the manifest. Tags are never overwritten unless `workflow_dispatch` passes `force_rebuild_sidecars: true`.

Seed the packages from an older run with the `SIDECARS_RUN_ID` repository variable or the `reuse_sidecars_run_id` input. The build job verifies the downloaded sidecars and pushes only the tags GHCR is missing, so existing tags stay intact. Clear the variable after seeding.

The GHCR owner comes from `github.repository_owner`, never a fixed name. The first release in a new repository must start with `SIDECARS_RUN_ID` and `reuse_sidecars_run_id` empty. A tag missing from this repository's package namespace pulls as a miss, so the job builds the sidecar instead of reusing an artifact from another repository. Use `force_rebuild_sidecars: true` only when an existing tag in this repository must be replaced.

A push to `releases` runs the same workflow and creates `vX.Y.Z` after all jobs pass.

For the 0.4.0 repository move, publish in this order: old tags (not `v0.4.0`), old releases, then the `releases` branch. A push to `releases` starts the 0.4.0 release, so it comes last.

1. Branch `X.Y.Z` from `releases`, bump `package.json`, `src-tauri/Cargo.toml` and `Cargo.lock`, and open `## X.Y.Z - unreleased` in `CHANGELOG.md`. Apply open Dependabot updates on the new version branch. Replace `unreleased` with the date in the last commit before the PR.
2. Run `pnpm typecheck && pnpm lint && pnpm deps && pnpm format:check && pnpm knip && pnpm test && pnpm build`, then `pnpm desktop:build` and `pnpm smoke`.
3. Manual rc runs: `workflow_dispatch` with `tag: vX.Y.Z-rc.N`, use `reuse_sidecars_run_id` or `force_rebuild_sidecars` only when needed.
4. Install the draft assets on real machines: mock run, real cheap-model run, history, Settings Test, no secrets in logs. On macOS also check the required `xattr -dr com.apple.quarantine` install step on the downloaded dmg. Then the update test: install the previous rc, start it with `UPAI_UPDATE_ENDPOINT` pointing at the new rc's `latest.json`, press **Install and restart**. Check the macOS keychain prompt once, run `xattr -l` on the installed app and find no quarantine line, check the Windows relaunch and the AppImage replace.
5. Open the pull request titled `X.Y.Z`, `pr-version` checks version, title, Cargo, lock and CHANGELOG.
6. Squash merge into `releases`. The workflow runs and creates `vX.Y.Z` only after every job passes.
7. Before publishing the draft, check the release has three `.sig` files (macOS `.app.tar.gz`, Windows `-setup.exe`, Linux `.AppImage`), the `.app.tar.gz` and `latest.json`. Publishing ships `latest.json` to every installed 0.3.2+ app, 0.4.0 included. Apps on 0.2.0 to 0.3.1 need the 0.3.2 bridge first. Keep the ffmpeg source archives attached (GPL).

Version branches start at `0.5.0`: branch `0.5.0` from `releases` after 0.4.0 is published, never from the local `0.4.0` branch.

Prebuilt ffmpeg and Node sidecars and the ffmpeg source archives are public on GHCR:
[unplatform-ai-sidecars](https://github.com/users/jefoce/packages/container/package/unplatform-ai-sidecars),
[unplatform-ai-sources](https://github.com/users/jefoce/packages/container/package/unplatform-ai-sources).

### Updates

Release builds pass `--config src-tauri/tauri.release.conf.json`, which turns on `createUpdaterArtifacts` and clears `beforeBuildCommand`. Only `.github/workflows/release.yml` passes it. `ci.yml` and local builds keep `createUpdaterArtifacts: false` and need no key. The build job reads `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` from repository secrets and uploads one `.sig` per installer. The `updater-manifest` job then writes `latest.json` from those signatures and the notes for the version in `CHANGELOG.md`.

Test the update path against an rc manifest by setting `UPAI_UPDATE_ENDPOINT` before launch, for example `https://github.com/jefoce/unplatform-ai/releases/download/v0.4.0-rc.1/latest.json`, then run the packaged app.

A local test against `http://127.0.0.1` needs `dangerousInsecureTransportProtocol` passed inline with `--config`, for example `pnpm desktop:build -- --config '{"plugins":{"updater":{"dangerousInsecureTransportProtocol":true}}}'`. Never commit the flag to `tauri.conf.json` or `tauri.release.conf.json`.

To roll back a bad release, edit it and mark it as a pre-release, or delete it. GitHub then marks the previous release as Latest, whose `latest.json` offers nothing newer. Apps already on the bad version need a fixed patch release.

## 19. Later: Developer ID and notarization

Not done yet. Until a Developer ID exists, `xattr -dr com.apple.quarantine "/Applications/Unplatform AI.app"` is a required install step, documented in the README, not an optional fix for a damaged app. It only clears the local quarantine flag for the downloaded copy. It does not change the signature, and it does not replace notarization.

When an Apple Developer ID is available:

1. Replace the ad-hoc identity with the Developer ID Application certificate. The `xattr` step leaves the install instructions at that point.
2. Sign the app, the staged Node sidecar and ffmpeg with hardened runtime and the existing entitlements.
3. Submit with `xcrun notarytool submit` and wait for acceptance.
4. Staple with `xcrun stapler staple`.
5. Re-test Keychain prompts. A stable signature should stop them returning after updates.
