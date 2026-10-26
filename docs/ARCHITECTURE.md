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
| Desktop | Tauri spawns the Node sidecar | `APP_TOKEN` cookie | Tauri exits the sidecar via `PARENT_PID` watch |

Updates run in the Rust shell. It reads `latest.json` from the GitHub release over HTTPS, checks the downloaded installer against the embedded public key, and installs only a version newer than the running one.

## 2. Code map

| Path | Contents |
|---|---|
| `src/core` | Pure logic, no IO. Shared by client and server. |
| `src/core/presets` | One file per model under its family folder. `family.ts` holds what the family shares. |
| `src/core/providers` | Provider descriptors for video and storage: ids, secret fields, links, HTTP rules. |
| `src/core/schemas` | Zod schemas for stored JSON: records, uploads, folders. |
| `src/core/provider-errors` | Error types, family tables, app rules and HTTP codes behind one `friendlyError`. |
| `src/core/types.ts` | Shared API shapes: records, uploads, folders, pricing, secrets, capabilities. |
| `src/core/catalog.ts` | Catalog entry, model status and catalog shapes shared by the client and the server. |
| `src/core/utility-types.ts` | Shared utility types `Dict` and `HasId`. |
| `src/server` | IO: boot, route helpers, jobs, services, repos, providers, storage, secrets, media, config. |
| `src/server/boot.ts` | Composition root. Lock, secrets, queue wiring, poller, parent watch, ffmpeg. |
| `src/server/config` | `isMockMode`, the app-wide dev switch shared by the provider and storage registries. |
| `src/server/jobs` | `submit-queue`, `run-submit`, `submit-media`, `submit-record`, `poller`, `download-queue`, `reconcile`. |
| `src/server/services` | Orchestration for routes and jobs: `credits`, `model-catalog`, `remote-inputs`, `remote-cap`, `upload-probe`, `uploads`, `connection-test`, `create-generation`, `estimate-generation`. |
| `src/server/providers` | `VideoProvider` interface, registry, OpenRouter adapter, mock adapter, `ProviderError` kinds. |
| `src/server/storage` | `ObjectStore` interface, registry, generic S3 store, R2 config, mock store, hashing. |
| `src/server/repos` | `generations`, `uploads`, `folders`, `json-dir-store`. |
| `src/server/sync` | `withLock`, the per-key serialization primitive, `createLimiter` for per-key caps, and `ttl-cache`, the `globalState` TTL cache. |
| `src/server/media` | `image-data-url`, `image-encode`, `to-data-url`, `thumbs`, `compat`, `ffmpeg`. |
| `src/features` | UI grouped by feature: generator, history, media picker, preview, settings, player, studio, updates. |
| `src/features/generator` | `panel`, `store`, `references`, `frames`, `prompt`, `options`, `model`, `credits`, `generate`. |
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
| `inputsSnapshot` | Kind, name, source, transport per upload | create route, run-submit |
| `submit` | Stage plus grace `notBefore` or progress | create route, run-submit |
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

### FolderItem (`data/folders.json`)

| Field | Meaning | Writer |
|---|---|---|
| `id` | UUID | folder route |
| `name` | Display name | folder route |
| `path` | Absolute folder path | folder route |
| `addedAt` | Sort key | folder route |

### Runtime files

| File | Meaning | Writer |
|---|---|---|
| `server.lock` | PID, port, mode, start time | instance lock |
| `desktop.json` | Desktop port, window bounds, close hint, `auto_check_updates` and `last_update_check`, written under one lock | Tauri shell |
| `secrets.json` | 0600 fallback when no OS keychain exists | file secret backend |
| `logs/server.log` | Sidecar log | Node server and Rust supervisor |
| `runtime/<version>/` | Writable copy of the bundled Next server | Tauri shell on first launch |

Desktop runs the sidecar from `runtime/<version>`, so Next cache writes never touch the signed bundle. The copy holds a `.upai-build` stamp naming the bundled build. A missing or different stamp restages the copy, and the stamp is written last. Older versions are removed after a successful boot.

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

Transport comes from `preset.inputTransport[kind]`. `auto` uses `url` when R2 is configured, else `base64`. Video and audio on R2 become presigned links with `REMOTE_LINK_TTL_SEC` lifetime. Keys are content addressed: `refs/<sha256><ext>`. Uploads are de-duplicated with `putOnce`, and the daily sweep removes objects unused for `REMOTE_UNUSED_DAYS`.

If a provider rejects base64 input, submit retries once with all media as URLs. A missing R2 for a `url` transport blocks validation before submit.

## 7. Presets

`src/core/presets/` is the only model registry. Each model has one file under its family folder, shared family files hold everything that does not differ. A preset controls duration, resolutions, aspect ratios, frames, audio, reference counts and per-kind limits, transport, prompt length, seed support, output sizes, labels, pricing keys, content policy and picker hints.

| Model | Duration | Resolutions | References (images / videos / audio) | Needs R2 for |
|---|---|---|---|---|
| Wan 3.0 | 2-30 s | 480p, 720p, 1080p | 10 / 5 / 5 | video, audio |
| Wan 3.0 Prime | 2-30 s | 480p, 720p, 1080p | 10 / 5 / 5 | video, audio |
| Seedance 2.0 | 4-15 s | 480p, 720p, 1080p, 4K | 9 / 3 / 3 | video |
| Seedance 2.5 | 4-30 s | 480p, 720p | 30 / 10 / 10 | video |

Each model holds `bindings` in priority order. A binding is `provider`, `modelId`, `pricing` and `transport` per media kind. The first binding whose provider is configured wins. A record stores the chosen provider and model id at submit time, so polling and download keep using that provider after settings change.

Pricing is serializable data. `skuRules` is an ordered list. Each rule has `when` conditions (`hasVideoInput`, `audio`, `hasTier`) and a `key` where `{resolution}` and `{tier}` are replaced. The first matching rule wins. `tiers` maps a resolution to its SKU suffix, for example `1080p` to `_1080p`. `fallback` holds a list rate for every key the rules can produce.

`/api/models` returns one catalog entry per preset. `available` means the provider lists the model. `unverified` means the model list cannot be read. `missing` means the list lacks the model. `no_provider` means no binding has a configured key. The catalog controls picker availability and price only. It never narrows preset capabilities at runtime.

Live pricing keeps list and effective rates. `getPricing` fetches `/api/v1/videos/models` for SKUs and `/api/v1/models/{author}/{slug}/endpoints` for the live `pricing.discount` in parallel, then applies `effective = list * (1 - discount)`. At the time of writing Wan 3.0 reports 0.15 while Prime and Seedance report 0. A failed endpoints call keeps live list rates at discount 0. Mock and fallback modes always use list prices. The Quality popover shows the struck list rate and the effective rate, plus a `% off` hint when a discount exists. No HTML scraping.

`minDuration` raises the selectable floor to `minBillableSec` when it is higher. The shortest selectable duration is 5 s on Wan and 4 s on Seedance. Wan presets bill at least 5 s, so a 2 s request costs 5 × the effective rate. `usage.cost` is the truth, and stored `pricePerSec` stays the raw rate.

Adding a model:

1. Read `/api/v1/videos/models` and the provider page for reference kinds and formats.
2. Add or reuse a family file under `src/core/presets/<family>/`. A model file holds only what differs from the family.
3. Add the preset to `MODEL_PRESETS` in `index.ts`, including pricing SKUs and fallbacks.
4. Run `pnpm vitest run tests/presets-contract.test.ts`.
5. Make one cheap real generation and record the result in the preset comment.
6. Update the models table above.

## 8. Concurrency

| Gate | Limit | Purpose |
|---|---|---|
| `withLock(key)` | 1 per key | Record, `upload:<id>`, `folders`, `secrets`, `compat:<hash>` |
| Submit queue | 2 active | Upload and send jobs |
| Poller | 3 parallel | OpenRouter status reads |
| Download queue | 2 active | Video downloads and previews |
| `thumbQueue` | 4 active | Thumbnail renders |
| `imageEncodeQueue` | 2 active | Image re-encode at upload |
| `compatQueue` | 2 active | Webview-safe copies |

The media caps use `createLimiter` (`src/server/sync/limiter.ts`). `globalState` keeps one singleton per process even when Next loads a module twice. `server.lock` prevents two servers from sharing one data folder. A live owner makes the new process exit with code 75, a stale lock is replaced.

Update checks run 15 s after launch, then every 12 h while auto-check is on (`UPDATE_CHECK_DELAY_MS`, `UPDATE_CHECK_INTERVAL_MS`). The toast and Settings share one install action, which keeps the downloaded bytes for a retry after cancel.

## 9. Secrets and session

Lookup order per key: environment variable, then the OS keychain or desktop bridge, then `secrets.json`. Env values are read-only in Settings. `getSecret` reads memory only, and `onSecretsChange` clears dependent caches such as the R2 store.

Desktop uses a bridge to the Rust shell over newline-delimited JSON on stdin/stdout. Node never calls the keychain in desktop mode. The webview never receives key values, only status with the last four characters.

Browser mode has no session token. Desktop sets `APP_TOKEN`, opens `/api/session?t=<token>`, and the page gets an HttpOnly `SameSite=Strict` cookie. `assertLocalRequest` enforces host, origin, `sec-fetch-site`, JSON content type and the session. Health and session routes opt out of the session check.

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
| `MAX_ACTIVE_JOBS` | 4 | Active generations allowed at once |
| `MAX_REQUEST_MB` | 64 | Total encoded request cap |
| `MAX_INLINE_MEDIA_MB` | 50 | Per-file inline media cap |
| `MAX_IDS` | 100 | Ids accepted in one history ids filter or reference plan |
| `SUBMIT_GRACE_MS` | 10000 | Cancel window before upload starts |
| `GRACE_STALE_MS` | 60000 | Grace older than this at boot is cancelled, not sent |
| `SHUTDOWN_SEND_WAIT_MS` | 60000 | Shutdown wait for an in-flight send |
| `POLL_INTERVAL_MS` | 8000 | Job polling interval |
| `HISTORY_POLL_MS` | 4000 | History refresh interval |
| `CREDITS_POLL_MS` | 60000 | Credit balance refresh interval |
| `UPDATE_CHECK_DELAY_MS` | 15000 | Delay before the first automatic update check |
| `UPDATE_CHECK_INTERVAL_MS` | 43200000 | Automatic update check interval |
| `MAX_JOB_AGE_MIN` | 360 | Age after which active jobs expire |
| `MAX_DOWNLOAD_RETRIES` | 5 | Download attempts before failing |
| `FETCH_TIMEOUTS.submit` | 300000 | Submit request timeout |
| `FETCH_TIMEOUTS.poll` | 30000 | Poll request timeout |
| `FETCH_TIMEOUTS.content` | 600000 | Video download timeout |
| `FETCH_TIMEOUTS.meta` | 15000 | Metadata and test timeout |
| `REMOTE_LINK_TTL_SEC` | 7200 | Presigned R2 link lifetime |
| `REMOTE_UNUSED_DAYS` | 30 | R2 retention after last use |
| `REMOTE_FREE_GB` | 10 | Cloudflare free R2 storage |
| `REMOTE_MAX_GB` | 8 | Tracked R2 storage cap, evicts older keys before a put |
| `UPLOAD_CLEANUP_MS` | 3600000 | Age before stale temp files are deleted |
| `THUMB_WIDTH` | 320 | Thumbnail width |
| `PREVIEW_WIDTH` | 640 | Preview frame width |
| `SEED_MAX` | 2147483647 | Maximum seed value |
| `MODEL_PRESETS` | see [presets/index.ts](../src/core/presets/index.ts) | Per-model duration, resolution, reference, prompt and size caps |

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

`core/provider-errors/` turns the stored text into a plain title and hint at render time. Family tables for Wan and Seedance run first, then app errors, then OpenRouter HTTP codes. First match wins, specific codes before parent codes, and a family table never matches the other family. Raw text stays on the record, the failed card and status overlay show the plain text, and Details exposes the raw text with Copy. Records written before a table change pick up the new text without migration.
