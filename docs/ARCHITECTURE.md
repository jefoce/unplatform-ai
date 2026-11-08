# Architecture

## 1. Overview

```
Tauri window (desktop) or browser tab
              |  HTTP on 127.0.0.1
        Next.js server
   routes | jobs | repos
      |          |        |
~/.unplatform-ai  OpenRouter  R2 (optional)
```

Two run modes, one server:

| Mode | Start | Session token | Parent |
|---|---|---|---|
| Browser | `pnpm dev` / `pnpm start` | none | none |
| Desktop | Tauri spawns the Node sidecar | `APP_TOKEN_FILE` 0600 JSON file, deleted after boot | Tauri exits the sidecar via `PARENT_PID` watch |

Updates run in the Rust shell. It reads `latest.json` from the GitHub release over HTTPS, checks the downloaded installer against the embedded public key, and installs only a version newer than the running one.

## 2. Code map

| Path | Contents |
|---|---|
| `src/core` | Pure logic, no IO. Shared by client and server. |
| `src/core/presets` | One file per model under its family folder. `family.ts` holds what the family shares. |
| `src/core/providers` | Provider descriptors for video and storage: ids, secret fields, links, HTTP rules. |
| `src/core/schemas` | Zod schemas for stored JSON: records, uploads, folders. |
| `src/core/provider-errors` | Error types, app rules and HTTP codes behind one `friendlyError`. Family rules live with their preset. |
| `src/core/types.ts` | Shared API shapes: records, uploads, folders, pricing, secrets, capabilities. |
| `src/core/catalog.ts` | Catalog entry, model status and catalog shapes shared by the client and the server. |
| `src/core/pricing` | Price formulas, quote composition and SKU rules for images and videos. |
| `src/core/media` | Shared media kinds, output sizes and formatting rules. |
| `src/core/feed` | Sorting, filtering, pagination and layout shared by the history and picker feeds. |
| `src/core/api` | Request and response schemas shared by the image routes and the client. |
| `src/core/protocol` | upai/1 wire schemas, error codes and job shapes, shared by client and server. |
| `src/core/utility-types.ts` | Shared utility types `Dict` and `HasId`. |
| `src/server` | IO: boot, route helpers, jobs, services, repos, providers, storage, secrets, media, config. |
| `src/server/boot.ts` | Composition root. Lock, secrets, queue wiring, poller, parent watch, ffmpeg. |
| `src/server/config` | `isMockMode`, the app-wide dev switch shared by the provider and storage registries. |
| `src/server/jobs` | `submit-queue`, `run-submit`, `submit-media`, `submit-record`, `poller`, `download-queue`, `reconcile`, plus `image-submit-queue`, `image-run`, `image-calls`, `image-reconcile`, `image-outputs` and `image-record`. |
| `src/server/services` | Orchestration for routes and jobs: `credits`, `model-catalog`, `remote-inputs`, `remote-cap`, `upload-probe`, `uploads`, `connection-test`, `create-generation`, `estimate-generation`, plus `image-create`, `image-actions` and `image-files`. |
| `src/server/services/endpoint-overview.ts`, `endpoint-save.ts`, `endpoint-tokens.ts` | Endpoint list, save, tokens and runtime counts. |
| `src/server/services/history-facets` | Incremental model, resolution and aspect facets over the record stores. |
| `src/server/services/endpoint-health` | Endpoint health state, fresh checks and the per-instance run limit. |
| `src/server/providers` | `VideoProvider` interface, registry, OpenRouter adapter, mock adapter, `ProviderError` kinds. |
| `src/server/providers/custom` | upai/1 adapter per endpoint, health probe, pinned requests and record source. |
| `src/server/storage` | `ObjectStore` interface, registry, generic S3 store, R2 config, mock store, hashing. |
| `src/server/repos` | `generations`, `images`, `uploads`, `folders`, `endpoints`, `json-dir-store`. |
| `src/server/sync` | `withLock`, the per-key serialization primitive, `createLimiter` for per-key caps, and `ttl-cache`, the `globalState` TTL cache. |
| `src/server/media` | `image-data-url`, `image-encode`, `to-data-url`, `thumbs`, `compat`, `ffmpeg`. |
| `src/features` | UI grouped by feature: generator, image generator, history, media picker, preview, settings, player, studio, updates. |
| `src/features/generator` | `panel`, `store`, `references`, `frames`, `prompt`, `options`, `model`, `credits`, `generate`. |
| `src/features/image-generator` | `panel`, `store`, `prompt`, `references`, `controls`, `submit`. |
| `src/features/history` | `list`, `details`, `status`, `filters`, `selection`, `actions`. |
| `src/features/media-picker` | `picker`, `uploads`, `folders`, `tiles`. |
| `src/ui` | Primitives (button, modal, popover, tabs, slider, tooltip). |
| `src/ui/form` | `Field`, `Input`, `NumberInput`, `PasswordInput`, `SearchInput`, `Switch`. |
| `src/lib` | Client helpers, `platform/` (browser and desktop), drop router, media support. |
| `src/lib/notify.ts` | `toastError` and `copyText`, the only toast helpers outside `src/features`. |
| `src/lib/use-*.ts` | Shared hooks: `useBoolean`, `useAsyncAction`, `useDebouncedValue`, `useNow`, `useMediaQuery`, `usePointerBlur`. |
| `src/lib/api` | Client functions for every route. The only place an API URL is written. |
| `src/app` | Next routes and the page shell. |
| `src-tauri` | Desktop shell, sidecar supervisor, window, settings and `updater.rs`. |
| `scripts` | `prepare-desktop.mjs`, `smoke-server.mjs`, `notices.mjs`. |
| `docs/protocol/upai-1` | Vendored upai/1 spec, schemas and fixtures, pinned in `SOURCE`. |
| `tests` | Vitest suites. |

Rules:

- `core` imports nothing from `server`, `features` or `lib`.
- Only `lib/platform/desktop.ts` imports `@tauri-apps/*`.
- One type per API shape lives in `src/core`, not next to a route or client function.
- One exported component per file. File names match the main export.
- Components take one `props` object, destructured on the first line. Functions and hooks with three or more inputs take one `params` object.

## 3. Data model

All records are JSON on disk. Names are uuid based: `<uuid>.json`, `<uuid>.mp4`, `<uuid>.preview.png`.

### GenerationRecord (`downloads/<uuid>.json`)

| Field | Meaning | Writer |
|---|---|---|
| `id`, `createdAt`, `updatedAt` | Identity and clock | create route, every save |
| `status` | Lifecycle state | submit queue, poller, download queue, cancel route |
| `input` | Exact panel state, canonical prompt slots | create route |
| `preset` | `id`, `title`, `slug` at submit time | create route |
| `source` | Provider kind, instance id, badge, title, workflow name and local flag at submit | create route |
| `presetSnapshot` | Loose preset copy: id, title, family plus model fields | create route |
| `inputsSnapshot` | Kind, name, source, transport per upload | create route, run-submit |
| `submit` | Stage plus grace `notBefore` or progress | create route, run-submit |
| `progress` | Percent, node, queue position and waiting reason | poller |
| `download` | `startedAt` while the file is queued or downloading | download queue |
| `job` | OpenRouter job id, timestamps, expiry | run-submit, poller |
| `seedUsed`, `favorite` | Resolved seed and user flag | create route, PATCH route |
| `cost` | Estimated and actual USD, price source | create route, poller |
| `output` | Video, preview, dimensions, bytes | download queue |
| `error` | Last human-readable failure | any job step |

### UploadItem (`uploads/<uuid>.json`)

| Field | Meaning | Writer |
|---|---|---|
| `id`, `source`, `kind`, `mime`, `ext` | Identity and file type | upload routes |
| `originalName`, `target`, `sizeBytes` | Display and link target | upload routes |
| `width`, `height`, `durationSec` | Probe results | upload routes |
| `createdAt`, `missing` | Age and missing linked source | upload routes, browse |
| `remote` | R2 key, sha256, size, timestamps | run-submit |

`source: link` points at a file in a connected folder, nothing is copied. `source: file` is a copy in `uploads/`.

### ImageRecord (`images/<uuid>.json`)

An image record carries the same `source`, `presetSnapshot` and `progress` fields as a video record. The status set differs: `submitting`, `saving`, `completed`, `partial`, `failed` and `cancelled`.

### FolderItem (`data/folders.json`)

| Field | Meaning | Writer |
|---|---|---|
| `id` | UUID | folder route |
| `name` | Display name | folder route |
| `path` | Absolute folder path | folder route |
| `addedAt` | Sort key | folder route |

### Custom endpoints (`data/endpoints.json`)

| Field | Meaning | Writer |
|---|---|---|
| `version` | File format version, currently 1 | endpoints repo |
| `endpoints` | id, label, badge, base URL, enabled, pricing, instance id and last health per endpoint | Settings save |
| `badgeCounter` | Last badge number handed out, so a deleted number is never reused | endpoints repo |

`data/endpoint-models/<id>.json` caches the upai/1 model lists for one endpoint: `fetchedAt`, `video`, `image` and `missingSince`. `CUSTOM_ENDPOINT_TOKENS` is one secret JSON map from endpoint id to bearer token. The raw token is never logged, and Settings shows only its last four characters.

### Runtime files

| File | Meaning | Writer |
|---|---|---|
| `server.lock` | PID, port, mode, start time and boot nonce | instance lock |
| `desktop.json` | Desktop port, window bounds, close hint, `auto_check_updates` and `last_update_check`, written under one lock | Tauri shell |
| `secrets.json` | 0600 fallback when no OS keychain exists | file secret backend |
| `logs/server.log` | Sidecar log | Node server and Rust supervisor |
| `runtime/<version>/` | Extracted copy of the bundled Next server archive | Tauri shell on first launch |

Desktop runs the sidecar from `runtime/<version>`, so Next cache writes never touch the signed bundle. First launch streams `Resources/server.tar.zst` into a `.staging-<pid>` folder, rejects paths and symlinks that leave the target, then renames the folder into place. The copy holds a `.upai-build` stamp copied from `Resources/server.build-id`. A missing or different stamp restages the copy, and the stamp is written last. A damaged archive removes the staging folder and shows a fatal error instead of leaving a half runtime. Older versions are removed after a successful boot.

The archive carries only the server. Every platform keeps `unplatform-ai-server` and `ffmpeg` as bundle sidecars beside the app binary, so the shell always spawns the sidecar and points `FFMPEG_PATH` at the bundled ffmpeg. The stamp is the server build id, compared whole. A version bump uses a new folder, and a same-version rebuild restages when `.next/BUILD_ID` changes.

## 4. Generation lifecycle

```
submitting/grace -> submitting/uploading -> submitting/sending
                                                  |
                                                  v
                    pending -> in_progress -> completed
                        |          |  |--> failed
                        |          |-----> cancelled
                        |----------------> expired
```

| Transition | Writer | Lock | Restart behavior |
|---|---|---|---|
| create -> `submitting/grace` | create route | none | `submit.notBefore` is absolute, so grace resumes |
| grace -> `uploading` | submit queue (max 2) | record id | a grace record is rescheduled |
| `uploading` -> `sending` | run-submit | record id | missing owner fails as interrupted |
| `sending` -> `pending` | run-submit | record id | missing owner fails as interrupted |
| cancel in grace | cancel route | record id | record and files are gone |
| `pending`/`in_progress` -> same or final | poller (max 3 parallel) | record id | polling resumes at boot |
| completed job -> `download` -> `completed` | download queue (max 2) | record id | a completed job without a file downloads again |
| download -> `completed` | download queue | record id | file and output fields are written together |

`completed` is saved only after the mp4 exists. Download failures return the record to `in_progress` and retry up to `MAX_DOWNLOAD_RETRIES`.

User-facing labels come from `src/core/status-help.ts`:

| Label | Video state | Image state |
|---|---|---|
| Processing | `submitting/grace`, or `pending` | `submitting/grace` |
| Uploading | `submitting/uploading` | `submitting/uploading` |
| Sending | `submitting/sending` | `submitting/sending` |
| Generating | `in_progress` | `saving` or `in_progress` |
| Downloading | `download` set | none, the write is immediate |
| Completed | `completed` | `completed` |
| Failed | `failed` | `failed` or `partial` |
| Expired | `expired` | `expired` |
| Cancelled | `cancelled` | `cancelled` |

## 5. Prompts and slots

Stored form is canonical `@Image 1`, `@Video 1`, `@Audio 1`. Slots are positional per kind, in reference order.

Accepted loose forms, converted on submit: `@image 1`, `@img1`, `[image 1]`. Bare `Image 1` converts only when that slot exists and starts uppercase.

Each tab keeps its own prompt. `frames` submits frames only, `references` submits references only. Frames mode drops `end` when `start` is empty. Per-model chips use `preset.refLabel`, display labels always use `Image N` style.

Validation warns when a prompt mentions a slot that has no attached reference, and when inline media or the request total exceeds limits.

## 6. Inputs and transport

| Input | Handling |
|---|---|
| File picked in the app | Copied into `uploads/`, then sent by the preset transport |
| File dropped or pasted | Copied, same as above |
| File linked from a connected folder | Path stored, original never moved |
| Pasted image | Re-encoded through sharp as sRGB, 4096 px ladder, transparency flattened or kept per preset |

Transport comes from `preset.inputTransport[kind]`. `auto` uses `url` when R2 is configured, else `base64`. Video and audio on R2 become presigned links with `REMOTE_LINK_TTL_SEC` lifetime. Keys are content addressed: `refs/<sha256><ext>`. Uploads are de-duplicated with `putOnce`. A `remoteCap` lock wraps the cap check and the put. The cap counts the listed `refs/` objects when the store can list, else the tracked upload sizes. The daily sweep removes objects unused for `REMOTE_UNUSED_DAYS` and untracked objects older than the link TTL.

If a provider rejects base64 input, submit retries once with all media as URLs. A missing R2 for a `url` transport blocks validation before submit.

Custom video and audio references use `upload`: the app hashes the file, asks the endpoint for an upload, then sends video and audio to ComfyUI. Images and frames stay inline as data URLs. Every custom request is pinned to the endpoint origin: scheme, host and port must match, and a redirect is refused.

## 7. Presets

`src/core/presets/` is the only model registry. Each model has one file under its family folder, shared family files hold everything that does not differ. A preset controls duration, resolutions, aspect ratios, frames, audio, reference counts and per-kind limits, transport, prompt length, seed support, output sizes, labels, pricing keys, content policy and picker hints.

| Model | Duration | Resolutions | References (images / videos / audio) | Needs R2 for |
|---|---|---|---|---|
| Wan 3.0 | 2-30 s | 480p, 720p, 1080p | 10 / 5 / 5 | video, audio |
| Wan 3.0 Prime | 2-30 s | 480p, 720p, 1080p | 10 / 5 / 5 | video, audio |
| Seedance 2.0 | 4-15 s | 480p, 720p, 1080p, 4K | 9 / 3 / 3 | video |
| Seedance 2.5 | 4-30 s | 480p, 720p | 30 / 10 / 10 | video |

Image presets live under `src/core/presets/image`, one file per family and one file per model. They define resolutions or a fixed size, aspect ratios, quality and background controls, reference limits, seed support and pricing. `IMAGE_PRESETS` in `image/index.ts` is the picker order and the source of the image model table in the README.

### Custom models

Custom presets are runtime data, not files. Each enabled endpoint serves its cached upai/1 model list, and `mapCustomModel` turns each model into a preset with id `custom.<endpointId>.<modelId>`. The mapper keeps only known resolutions and aspect ratios, rounds the duration to its step, maps output sizes, reference counts, frames, seed, prompt limit and count, and prices the run at `perRun` from the model price. Dropped values become warnings, and a video model missing a duration, resolution or aspect ratio produces no preset.

A model is `ready`, `stale` or `invalid`. Ready is available. Stale is available with a reason and Generate is blocked until the workflow is saved again in ComfyUI. Invalid is disabled, with the reason from the pack. A model missing from a fresh model list stays selectable as missing for `CUSTOM_MISSING_KEEP_DAYS`, then disappears.

Each model holds `bindings` in priority order. A binding is `provider`, `modelId` and `pricing`, plus `transport` per media kind for video. The first binding whose provider is configured wins. A record stores the chosen provider and model id at submit time, so polling and download keep using that provider after settings change.

Model data is shared, adapters are not. `src/core/providers/registry.ts` holds descriptors only. `src/server/providers/registry.ts` hard-codes the video factories and takes image factories through `registerImageProvider` at boot, so mock selection stays in the composition root.

Pricing is serializable data under `src/core/pricing`. A binding's `pricing` holds a `formula` (`perSecond`, `videoTokens`, `perImage`, `imageTokens`, `megapixel`), ordered `skuRules`, a `fallback` SKU table and optional token facts. Each rule has `when` conditions (`resolution`, `quality`, `aspect`, `hasVideoInput`, `audio`, `hasTier`) and a `key` where `{resolution}`, `{quality}`, `{aspect}` and `{tier}` are replaced. The first matching rule wins. `tiers` maps a resolution to its SKU suffix, for example `1080p` to `_1080p`. `tokens` holds model token counts, which are preset facts, not provider data. `quote({ preset, binding, ctx, skus })` returns the per-unit and total price for either kind. An image estimate multiplies the quoted image price by the requested count, then adds the reference token cost for token-priced models.

`/api/models` returns one catalog entry per preset. `available` means the provider lists the model. `missing` means the model is absent from the list and the endpoint listing answers 404 or has no endpoints. `unverified` means the model list cannot be read, or the model is absent but the endpoint listing is present or unknown. `no_provider` means no binding has a configured key. Availability is the model list plus the endpoint listing, never capability drift. The catalog controls picker availability and price only. It never narrows preset capabilities at runtime.

Live pricing goes through the adapter registry in `src/server/pricing/live.ts`. `registerLivePricing(provider, kind, loader)` wires one loader per provider and kind. OpenRouter video reads `/api/v1/videos/models` for SKUs and `/api/v1/models/{author}/{slug}/endpoints` for the live `pricing.discount`, then applies `effective = list * (1 - discount)`. OpenRouter image reads each `/api/v1/images/models/{id}/endpoints`, maps lines to `${billable}_${variant ?? 'base'}_${unit}` and keeps the highest rate per key. A new provider adds an adapter and presets, never an engine change. Estimates and create store `priceSource: 'live' | 'fallback'`. Mock and fallback modes always use list prices. The Quality popover shows the struck list rate and the effective rate, plus a `% off` hint when a discount exists. No HTML scraping.

`minDuration` raises the selectable floor to `minBillableSec` when it is higher. The shortest selectable duration is 5 s on Wan and 4 s on Seedance. Wan presets bill at least 5 s, so a 2 s request costs 5 × the effective rate. `usage.cost` is the truth, and stored `pricePerSec` stays the raw rate.

Adding a model:

1. Read `/api/v1/videos/models` and the provider page for reference kinds and formats.
2. Add or reuse a family file under `src/core/presets/<family>/`. A model file holds only what differs from the family.
3. Add the preset to `VIDEO_PRESETS` in `index.ts`, including pricing SKUs and fallbacks.
4. Run `pnpm vitest run tests/presets-contract.test.ts`.
5. Make one cheap real generation and record the result in the preset comment.
6. Update the models table above.

## 8. Concurrency

| Gate | Limit | Purpose |
|---|---|---|
| Active generations | 4 per kind | `MAX_ACTIVE_JOBS` for video and `IMAGE_MAX_ACTIVE` for image, each checked and inserted under one lock per kind |
| Custom submit | `max_running` per endpoint instance | Submit queue keyed by `custom:<instance>`. Endpoints that report the same `instance_id` share one limit, default 1. |
| `withLock(key)` | 1 per key | Record, `upload:<id>`, `folders`, `secrets`, `compat:<hash>` |
| Submit queue | 2 active | Upload and send jobs |
| Poller | 3 parallel | OpenRouter status reads |
| Download queue | 2 active | Video downloads and previews |
| `thumbQueue` | 4 active | Thumbnail renders |
| `imageEncodeQueue` | 2 active | Image re-encode at upload |
| `compatQueue` | 2 active | Webview-safe copies |

The media caps use `createLimiter` (`src/server/sync/limiter.ts`). `globalState` keeps one singleton per process even when Next loads a module twice. `server.lock` prevents two servers from sharing one data folder. Health returns the boot nonce publicly, and a live owner with the same nonce makes the new process exit with code 75. A stale lock is replaced.

Update checks run 15 s after launch, then every 12 h while auto-check is on (`UPDATE_CHECK_DELAY_MS`, `UPDATE_CHECK_INTERVAL_MS`). The toast and Settings share one install action, which keeps the downloaded bytes for a retry after cancel.

## 9. Secrets and session

Lookup order per key: environment variable, then the OS keychain or desktop bridge, then `secrets.json`. Env values are read-only in Settings. `getSecret` reads memory only, and `onSecretsChange` clears dependent caches such as the R2 store.

Desktop uses a bridge to the Rust shell over newline-delimited JSON on stdin/stdout. Node never calls the keychain in desktop mode. The webview never receives key values, only status with the last four characters.

Desktop writes one 0600 JSON file with the session token, the parent secret and the boot nonce, passes its path in `APP_TOKEN_FILE`, and the server reads and deletes it at boot. Browser mode mints a token at boot and prints `http://127.0.0.1:<port>/session#t=<token>` once. Writes without a session return 401 in every mode. Only the parent secret can register a save-dialog path. The shell then opens `/session#t=<token>`. The fragment never reaches the server: the page POSTs the token to `/api/session`, gets an HttpOnly `SameSite=Strict` cookie, and replaces the URL with `/`. `assertLocalRequest` enforces host, origin, `sec-fetch-site`, JSON content type and the session. Health and session routes opt out of the session check.

## 10. Platform layer

| Capability | Browser | Desktop |
|---|---|---|
| Choose files or folder | file input fallback | native dialog plugin |
| Drag and drop paths | web drop event | Tauri drag-drop events |
| Notifications | Web Notification API | notification plugin |
| Open links | `window.open` | opener plugin, scoped to `openrouter.ai`, `dash.cloudflare.com`, `github.com/jefoce/unplatform-ai*` |
| Save video | download anchor | native save dialog |
| Confirm discard | `window.confirm` | native confirm |
| Updates | none | `update_info`, `update_check`, `update_install`, `update_set_auto`, `update_open_release` |

Only `src/lib/platform/desktop.ts` imports Tauri packages. Features call the `Platform` interface.

## 11. Bounds

| Constant | Value | Meaning |
|---|---|---|
| `AUTOPLAY_DELAY_MS` | 500 | Pause before a viewer autoplays |
| `BLUR_SATURATION` | 1.5 | Saturation applied to the pre-blurred stage backdrop |
| `BLUR_SIGMA` | 8 | Gaussian sigma of the pre-blurred stage backdrop |
| `BLUR_WIDTH` | 96 | Pre-blurred stage backdrop width |
| `CREDITS_FOCUS_STALE_MS` | 30000 | Focus refresh when the last credits fetch is older |
| `CREDITS_POLL_MS` | 60000 | Credit balance refresh interval |
| `CREDITS_SETTLE_MS` | 15000 | Follow-up credits refresh after a job finishes |
| `CREDITS_SETTLE_WINDOW_MS` | 120000 | Window for a newly seen settled record to trigger a refresh |
| `CREDIT_DANGER_USD` | 0.5 | Balance that shows the danger color |
| `CREDIT_WARN_USD` | 2 | Balance that shows the warning color |
| `CUSTOM_CHECK_TIMEOUT_MS` | 3000 | Fresh availability check timeout on Generate |
| `CUSTOM_DURATION_MAX_SEC` | 120 | Longest duration a custom model may advertise |
| `CUSTOM_DURATION_OPTIONS_MAX` | 64 | Most quick-pick duration options kept from one custom model |
| `CUSTOM_IMAGE_MAX_WAIT_MS` | 900000 | Longest wait for one custom image job |
| `CUSTOM_MISSING_KEEP_DAYS` | 30 | Days a missing custom model stays in the cache |
| `CUSTOM_REF_TOTAL_SEC` | 30 | Combined reference seconds custom presets advertise |
| `CUSTOM_VIDEO_DOWNLOAD_MAX_BYTES` | 536870912 | Largest video download accepted from a custom endpoint |
| `DETAILS_MIN_WIDTH` | 240 | Minimum details panel width |
| `DOCKED_PANEL_EDGE_GAP` | 16 | Gap between a docked panel and the viewport edges |
| `DOCKED_PANEL_WIDTH` | 560 | Default docked panel width, the video picker size |
| `DOWNLOAD_STAGGER_MS` | 300 | Delay between batch download starts |
| `ENDPOINT_HEALTH_MAX_AGE_MS` | 30000 | A health state older than this is refreshed on the next use |
| `EXPORT_TOKEN_TTL_MS` | 600000 | Window to use a save-dialog path |
| `FETCH_TIMEOUTS.submit` | 300000 | Submit request timeout |
| `FETCH_TIMEOUTS.poll` | 30000 | Poll request timeout |
| `FETCH_TIMEOUTS.content` | 600000 | Video download timeout |
| `FETCH_TIMEOUTS.meta` | 15000 | Metadata and test timeout |
| `FFMPEG_TIMEOUTS.probe` | 15000 | Probe timeout |
| `FFMPEG_TIMEOUTS.frame` | 30000 | Frame extraction timeout |
| `FFMPEG_TIMEOUTS.compatBase` | 30000 | Base compat transcode timeout |
| `FFMPEG_TIMEOUTS.compatPerSec` | 10000 | Extra compat time per second |
| `FFMPEG_TIMEOUTS.compatMax` | 600000 | Compat transcode cap |
| `FFMPEG_TIMEOUTS.mock` | 60000 | Mock ffmpeg timeout |
| `FLATTEN_LUMINANCE` | 0.6 | Luminance threshold for flattening transparency |
| `GRACE_STALE_MS` | 60000 | Grace older than this at boot is cancelled, not sent |
| `HIDDEN_POLL_MS` | 15000 | Slower history tick while the page is hidden |
| `HISTORY_BATCH_MAX` | 200 | Records in one batch action |
| `HISTORY_GRID_GAP` | 12 | History grid gap |
| `HISTORY_MAX_PAGE_SIZE` | 50 | Maximum history page size |
| `HISTORY_PAGE_SIZE` | 20 | Default history page size |
| `HISTORY_POLL_MS` | 4000 | History refresh interval |
| `HISTORY_SCROLL_DELAY_MS` | 300 | Delay before restoring the scroll position |
| `IMAGE_COUNT_MAX` | 4 | Images requested in one image generation |
| `IMAGE_GRID_GAP` | 4 | Image grid gap |
| `IMAGE_MAX_ENCODED_MB` | 8 | App cap per encoded image |
| `IMAGE_MAX_SIDE_PX` | 4096 | Long side cap for reference images |
| `IMAGE_OUTPUT_MAX_BYTES` | 50331648 | Largest image output accepted per image in one response |
| `IMAGE_REFERENCE_MAX` | 16 | References on one image generation |
| `IMAGE_REFERENCE_MAX_MB` | 5 | Reference image size cap |
| `IMAGE_REFERENCE_MAX_SIDE_PX` | 2048 | Reference image side cap |
| `IMAGE_ROW_MAX_HEIGHT` | 640 | Masonry row height cap |
| `IMAGE_ROW_OVERSCAN` | 2 | Masonry rows rendered outside the viewport |
| `IMAGE_SUBMIT_PARALLEL` | 2 | Image submit calls running at once |
| `LOCK_BOOT_GRACE_MS` | 60000 | Live owner with a younger lock is still starting |
| `LOW_RES_MIN_PX` | 300 | Low-resolution threshold |
| `MAX_ACTIVE_JOBS` | 4 | Active video generations allowed at once |
| `IMAGE_MAX_ACTIVE` | 4 | Active image generations allowed at once, counted apart from video |
| `MAX_DOWNLOAD_RETRIES` | 5 | Download attempts before failing |
| `MAX_FAVORITE_EPOCHS` | 1000 | Favorite ids kept so a slow poll cannot revert a recent pick |
| `MAX_IDS` | 100 | Ids accepted in one history ids filter or reference plan |
| `MAX_IMAGE_PIXELS` | 50000000 | Decode cap for user images |
| `MAX_INLINE_MEDIA_MB` | 50 | Per-file inline media cap |
| `MAX_JOB_AGE_MIN` | 360 | Age after which active jobs expire |
| `MAX_PROVIDER_B64_CHARS` | 89478486 | Base64 image cap before decode |
| `MAX_JSON_BODY_BYTES` | 1048576 | One JSON request body |
| `MAX_REQUEST_MB` | 64 | Total encoded request cap |
| `MAX_UPLOAD_BYTES` | 67108864 | Multipart request cap |
| `MAX_UPLOAD_FILES` | 20 | Files accepted in one multipart upload |
| `MODEL_CATALOG_TTL_MS` | 60000 | Model catalog cache lifetime |
| `MODEL_LIST_MAX_PAGES` | 20 | Model list pages followed before the list is incomplete |
| `MOCK_GENERATE_MS` | 6000 | Mock generation duration |
| `MOCK_QUEUE_MS` | 3000 | Mock queue duration |
| `OPENROUTER_VIDEO_MAX_BYTES` | 2147483648 | Largest video download accepted from OpenRouter |
| `POLL_INTERVAL_MS` | 8000 | Job polling interval |
| `POLL_PARALLEL` | 3 | Parallel status polls |
| `PREVIEW_AT_SEC` | 0.5 | Preview frame time |
| `PREVIEW_GRACE_MS` | 30000 | How long a finished video may keep polling for its poster |
| `PREVIEW_MAX_WIDTH` | 1920 | Preview frame max width |
| `PREVIEW_QUALITY` | 90 | Preview WebP quality |
| `PREVIEW_WIDTH` | 640 | Default poster request width |
| `PRICE_DEBOUNCE_MS` | 500 | Price and estimate debounce |
| `PRICING_FALLBACK_TTL_MS` | 300000 | Fallback price cache lifetime |
| `PRICING_LIVE_TTL_MS` | 3600000 | Live price and discount cache lifetime |
| `PROVIDER_RAW_MAX_CHARS` | 500 | Raw provider text kept per failure |
| `REMOTE_FREE_GB` | 10 | Cloudflare free R2 storage |
| `REMOTE_LINK_TTL_SEC` | 7200 | Presigned R2 link lifetime and orphan sweep cutoff |
| `REMOTE_MAX_GB` | 8 | R2 storage cap from the listed `refs/` objects, evicts older keys before a put |
| `REMOTE_MOCK_MBPS` | 20 | Mock R2 speed |
| `REMOTE_REFRESH_DAYS` | 25 | Refresh before the R2 lifecycle rule |
| `REMOTE_UNUSED_DAYS` | 30 | R2 retention after last use |
| `REQUEST_RESERVE_MB` | 1 | Space kept for the JSON body and prompt |
| `ROW_MIN_HEIGHT` | 280 | Minimum list row height |
| `SEED_MAX` | 2147483647 | Maximum seed value |
| `SHUTDOWN_DOWNLOAD_WAIT_MS` | 630000 | Shutdown wait for a download |
| `SHUTDOWN_EXIT_DELAY_MS` | 100 | Delay between shutdown steps |
| `SHUTDOWN_IMAGE_WAIT_MS` | 1220000 | Shutdown wait for every queued image record's waves |
| `SHUTDOWN_SEND_WAIT_MS` | 305000 | Shutdown wait for an in-flight send (submit timeout plus margin) |
| `SUBMIT_GRACE_MS` | 10000 | Cancel window before upload starts |
| `SUBMIT_QUEUE_CONCURRENCY` | 2 | Records one submit queue runs at once |
| `SUBMIT_YIELD_MS` | 50 | Yield between submit queue steps |
| `THUMBS_MAX_BYTES` | 1073741824 | Thumb cache cap |
| `THUMBS_TARGET_BYTES` | 838860800 | Thumb cache trim target |
| `THUMB_ENCODER_VERSION` | 1 | Thumb encoder version in the cache key |
| `THUMB_TOUCH_MS` | 86400000 | Thumb mtime refresh interval |
| `THUMB_UNUSED_DAYS` | 30 | Thumb cache retention |
| `THUMB_WIDTH` | 320 | Thumbnail width |
| `UPDATE_CHECK_DELAY_MS` | 15000 | Delay before the first automatic update check |
| `UPDATE_CHECK_INTERVAL_MS` | 43200000 | Automatic update check interval |
| `UPLOAD_CLEANUP_MS` | 3600000 | Age before stale temp files are deleted |
| `ZOOM_DEFAULT` | 5 | Default zoom step |
| `ZOOM_MAX` | 5 | Maximum zoom step |
| `ZOOM_MIN` | 0 | Minimum zoom step |
| `ZOOM_STEPS` | 6 | Number of zoom steps |
| `VIDEO_PRESETS` | see [presets/index.ts](../src/core/presets/index.ts) | Per-model duration, resolution, reference, prompt and size caps |

## 12. Edge cases

| Case | Behavior | Where |
|---|---|---|
| Upload deleted while used by a running generation | 409, record keeps the reference | uploads DELETE route |
| Upload deleted from a draft | Draft clears or shows missing on next validation | generator store, validation |
| Linked source moved | Upload marked `missing`, submit fails with `File missing` | uploads repo, run-submit |
| Reload before uploads load | Unknown ids kept, limits applied once kinds are known | `normalizeForPreset` |
| Restart in grace | Younger than a minute resumes, older becomes `cancelled` | submit queue, reconcile |
| Restart while uploading or sending | Failed as interrupted, no automatic resend | reconcile |
| Restart with pending or in-progress job | Polling resumes | poller boot |
| Restart after completed job before download | File downloads again | poller, download queue |
| Two servers on one data folder | Second exits with code 75 | instance lock |
| Key removed during a running job | Poller stores an auth error on the card | poller |
| R2 object deleted outside the app | Next use uploads it again | `ensureRemote` |
| Same file in two generations | One upload, `putOnce` shares the object | remote inputs |
| Output link expired before download | Record becomes `expired` | download queue |
| Preferred desktop port busy | App picks a free port and saves it | Tauri boot |
| Keychain prompt waiting | Desktop bridge times out after 60 s, Settings shows the wait | bridge, Settings |

## 13. Error handling

Routes throw `HttpError` with a status and a short message. `errorResponse` turns it into JSON. Validation errors use 400, bad session 401, foreign host or origin 403, missing record 404, conflicts 409, unsupported media 415, missing JSON 415. Unknown failures become a generic 500, and the detail goes to `logs/server.log` with the `[unplatform-ai]` prefix.

Job errors are stored on the record as `error`, never thrown to the UI after the request ended. Secrets and presigned URLs are never logged.

`core/provider-errors/` turns the stored text into a plain title and hint at render time. Each preset file exports its family `errors` rules under `src/core/presets/{video,image}/<family>/errors.ts`. Those rules run first, then app errors, then the provider HTTP codes. First match wins, specific codes before parent codes, and a family table never matches the other family. Raw text stays on the record, the failed card and status overlay show the plain text, and Details exposes the raw text with Copy. Records written before a table change pick up the new text without migration.

Custom adapter errors keep the raw `upai:<code>: <message>` line. `src/core/presets/custom/errors.ts` maps the code to a title and hint: unauthorized, forbidden, invalid_request, model_not_found, workflow_invalid, too_large, queue_full, job_failed, comfy_unavailable, config_invalid, timeout and endpoint_removed. The custom family never falls through to the OpenRouter rules.
