# Decisions

## 2026-11-07 - upai/1 is vendored, not generated

Decision: `docs/protocol/upai-1` holds the spec, schemas and fixtures from `unplatform-ai-provider-node` at commit `6f187d6`, recorded in `SOURCE`. The copy includes the optional `prompt.reference_label` capability. A drift test pins both the `SOURCE` file and the fixtures.

Why: the adapter, the pack and the tests need one wire contract, and a moving external repo would make the fixtures disagree.

## 2026-11-07 - Provider kinds and instances

Decision: `PROVIDER_KIND_IDS` is `openrouter` and `custom`. A custom endpoint is an instance of the `custom` kind with its own id and badge. A record stores `provider` plus `source` with `kind`, `instanceId`, `badge`, `presetTitle`, `workflowName`, `endpointLabel` and `local`. A new provider kind adds an id and an adapter, and no record change.

Why: one record shape serves both kinds, and history keeps its labels after an endpoint is deleted.

## 2026-11-07 - Endpoints are one JSON file with a badge counter

Decision: `data/endpoints.json` holds `endpoints` and `badgeCounter`. Badges are `CU<n>`, allocated under the endpoints lock. The counter never goes back, so a deleted number is not reused. Bearer tokens live in one `CUSTOM_ENDPOINT_TOKENS` secret map keyed by endpoint id.

Why: the list is small and a single file keeps the save atomic. One token map means one secret write per save.

## 2026-11-07 - No SQLite, facets come from the record stores

Decision: history facets are built from the in-memory `json-dir-store` records, updated on the store `onChange` hook and re-aggregated on the next read. There is no database.

Why: the repos already hold every record in memory, and a second index on disk would need its own recovery and migration.

Rejected: SQLite and a per-file facet cache.

## 2026-11-07 - A workflow rename creates a new custom model id

Decision: the wire model id is `<workflow-slug>.<model-id>`. Renaming a workflow in ComfyUI changes its slug and creates a new id. Old history keeps the `presetSnapshot` title, workflow name and badge from submit time.

Why: the pack identifies models by workflow file name, and history must stay readable after the rename.

## 2026-11-07 - Local zero price hides the price

Decision: `showPrice` hides a price when the source is local and the amount is zero. An API model at zero still shows `$0.00`. A custom record writes `actualUsd` from its resolved price, so credits count it as known.

Why: a local run costs nothing, and a hidden zero reads better than a dollar sign. Writing zero keeps the unknown count honest.

## 2026-11-07 - Deleting an endpoint is allowed with running jobs

Decision: Settings warns when an endpoint with running jobs is deleted, and the save proceeds. Video jobs fail with `upai:endpoint_removed` and the card says "This endpoint was removed." No cancel call is sent to ComfyUI.

Why: the user owns the endpoint and the warning names the cost. A cancel call to a removed endpoint would fail anyway.

## 2026-11-07 - Custom submits limit per endpoint instance

Decision: custom submits use one queue per pack instance, keyed by `instanceId`. The limit is the smallest fresh `max_running` from health, default 1. Two endpoints that report the same `instance_id` share one queue and one limit.

Why: one ComfyUI install runs one set of jobs, and two badges for the same install must not double the load.

## 2026-11-07 - Custom fetch pins the endpoint origin

Decision: `customRequest` rebuilds the URL from the endpoint origin plus `/upai`, refuses a different origin, sets `redirect: 'manual'` and rejects every 3xx. `safeFetchProviderUrl` stays on the OpenRouter path.

Why: an endpoint URL comes from the user, so a redirect or an absolute path must not move a request to another host.

## 2026-11-07 - Quit guard keeps ComfyUI video jobs

Decision: a running custom video job keeps the quit guard visible but is not waited on. ComfyUI keeps the job and the app resumes polling on the next start. A running custom image job is cancelled at shutdown.

Why: a video job lives on ComfyUI and survives the app. An image job lives in the app's process, so it cannot resume.

## 2026-11-07 - Preset snapshot is loose

Decision: `presetSnapshot` stores only `id`, `title`, `family`, because custom presets have no zod schema. `source` covers display labels, badge and workflow name.

Why: snapshotting a runtime preset cannot be strict, and the fields history needs already live in `source`.

## 2026-11-07 - Image Stop is not in history

Decision: 0.5.0 has no Stop for a running custom image job in history, because an image record has no job reference. Stop in ComfyUI is available for a running video, whose record stores the job id.

Why: adding a job id to image records is a bigger data change than the release needs, and a Stop button that cannot find its job would be worse than none.

## 2026-11-04 - Animations ignore the OS reduced-motion setting (owner decision, 0.4.0)

Decision: no `prefers-reduced-motion`, `motion-reduce:` or `motion-safe:` variant in `src`. The grace pill fade, the status glow and the workspace transitions run the same for every user. `prefers-reduced-transparency` still applies.

Why: the owner wants the animation on every machine, and the app has no motion that blocks reading or input.

Rejected: honoring the OS setting, which removed the glow and froze the grace fade.

## 2026-11-03 - Status labels describe the work, not the internal stage

Decision: one help table in `src/core/status-help.ts` owns the labels. Video `pending` shows Processing, image `saving` shows Generating, and the old `in_queue` key is gone. The README status table, pill, tooltip, notifications, window title and quit dialog use the same labels.

Why: `image-run` set a record to `saving` before the provider call, so the tile said Downloading while the model was still generating. OpenRouter also kept videos in `pending` for most of a run, so In queue right after Generate read wrong.

Rejected: a label map per view, and exposing internal stage names to users.

## 2026-11-03 - One picker card size, the image picker matches its prompt bar

Decision: `PICKER_TILE_PX` is 120.5 px, computed once from the 560 px video panel: the panel width minus its border and padding, the grid padding and three gaps, divided by four. The video picker keeps `DOCKED_PANEL_WIDTH` (560) and four columns. The image picker passes `width: 'anchor'`: the panel width equals the prompt bar rect, clamped to `innerWidth - 2 * DOCKED_PANEL_EDGE_GAP`, centered on the bar. Every picker grid uses `repeat(auto-fill, PICKER_TILE_PX)` with centered content, and `pickerColumns` derives the row size for windowing from the measured width.

Why: a fixed 4-column grid in two widths gave different card sizes in each tab. One card size keeps tiles equal while the wider image bar fits more columns.

Rejected: a fixed width for both pickers, and a per-tab column count.

## 2026-11-02 - Node and ffmpeg stay in the bundle, only the server is packed

Decision: `unplatform-ai-server` (Node) and `ffmpeg` stay Tauri sidecars on every platform, and only the Next server is packed as `Resources/server.tar.zst`. `tauri.conf.json` lists both in `bundle.externalBin`; no platform config empties it. The extracted runtime folder holds the server alone, and `server.build-id` is `.next/BUILD_ID` only.

Why: packing the runtime shrank the app but grew the install, because the extracted copy carried the packed binaries too. Sidecars stay in the signed bundle, and the mutable Next cache still writes into a copy without them. Measured macOS arm64 on 2026-11-02:

| Part | Bytes | MiB |
|---|---:|---:|
| App bundle | 86,530,330 | 82.5 |
| Extracted runtime | 46,187,444 | 44.0 |
| Install total | 132,717,774 | 126.6 |
| DMG | 35,749,578 | 34.1 |
| `server.tar.zst` | 11,699,059 | 11.2 |

Rejected: packing Node and ffmpeg into the archive. The app fell to 41,535,312 bytes, the server archive to 30,037,317 bytes and the DMG to 36,368,174 bytes, but the extracted runtime carried a second copy of both binaries, so the installed layout was no smaller.

## 2026-10-31 - 0.4.0 ships only in jefoce/unplatform-ai

Decision: 0.4.0 is a fresh install in `jefoce/unplatform-ai`. A 0.3.x install moves through the 0.3.2 bridge in the old repository. 0.4.0 carries no migration.

Why: the repository rename changes the update endpoint. The old repository publishes 0.3.2 with the new endpoint, so 0.3.1 or older updates once through the bridge and then updates normally from the new repository. 0.4.0 does not read or move data from an older install.

Rejected: shipping a migration in 0.4.0 for an endpoint change. An installed app cannot learn the new endpoint from a release it cannot reach.

## 2026-10-28 - R2 cap reads the bucket listing under a lock

Decision: `makeRoom` counts the listed `refs/` objects when the store can list, and falls back to the tracked upload sizes. It shares one `remoteCap` lock with the put. The sweep also deletes untracked `refs/` objects older than `REMOTE_LINK_TTL_SEC`.

Why: upload records can go missing while their objects stay in the bucket. The listing keeps the cap true, and the lock keeps two puts from both passing it.

Rejected: trusting only the upload records, which misses orphaned objects.

## 2026-10-28 - R2 bucket is dedicated to one computer and has a lifecycle backstop

Decision: one computer uses the R2 bucket, and the bucket holds only this app's objects. The guide asks the user to add a lifecycle rule that deletes `refs/` objects after 30 days. The app never sets the rule, because its token usually has object permissions only.

Why: the cap and the cleanup only know this computer's records. Another computer's objects look unreferenced, so each side deletes the other's unused objects and uploads them again on the next use. The app stays correct, only traffic and storage churn is wasted. Files outside `refs/` never get deleted and count against the 10 GB free tier. The app cleans up only while it runs, so the rule is a backstop when it is never opened again.

Rejected: sharing a bucket between computers or with other files, and an app-managed lifecycle rule that needs bucket administration permissions.

## 2026-10-27 - Live picker selection and docked panel

Decision: the picker has no Add confirm step and no local selection. Toggle mode adds or removes through the opener. Folder files link on click and match an attached upload by `target`. The panel docks beside the references or frames box, fixed height, vertically centered, and closes on any click outside that box. A request carries an `openerKey`: the same key keeps the open request, a different key replaces it.

Why: a click on a file should show its real state immediately, and reference order and limits already live in the generator store.

Rejected: local multi-select plus Add (two sources of truth), anchoring to the clicked tile (a second opener could not replace the request), anchoring to the whole generator panel (a click anywhere in the panel would have to stay open).

## 2026-10-26 - Workflow logic lives in scripts and composite actions

Decision: `.github/scripts` holds the bash and Node logic, each script taking arguments instead of `${{ }}`. `.github/actions` holds the three repeated step groups: setup-pnpm, sidecar-restore and sidecar-publish. Workflow files keep the job graph and pass inputs.

Why: the logic is testable (`tests/ci-scripts.test.ts`), linted by shellcheck and actionlint, and exists once. The GHCR pull, push, sources tag and setup steps had four or five copies each.

Rejected: a reusable workflow per sidecar. The matrix plus the build differences (ffmpeg, Node Unix, Node Windows) made a shared workflow harder to read than a composite action plus the job step.

## 2026-10-25 - Every arrow function has a block body

Decision: `arrow-body-style` is `['error', 'always']` in `src` and `tests`. Every arrow uses braces and an explicit `return`, including one-line `map`, `filter` and `catch` callbacks.

Why: one shape everywhere. A block body reads top to bottom, and the writer never picks between an expression and a block. Prettier owns the layout.

Rejected: expression bodies for one-line callbacks, and a length or comment exception.

## 2026-10-25 - A function used by one hook is written inline

Decision: `local/inline-hook-callbacks` flags a `const` function used once by one hook. Moving a function that captures nothing to module level, and keeping the name when it is used twice, are conventions. Hook results stay objects (`deletion.run`), not tuples.

Why: one name per action. A separate action, a `run` alias and a handler make the reader connect three names. `const deletion = useAsyncAction(async () => { ... })` keeps the action at the call site and drops the indirection.

Rejected: a named constant next to every hook call, and tuple results from hooks.

## 2026-10-25 - `try` and `catch` stay native

Decision: no `Result<T>` type and no `attempt` helper. Errors are caught with `try` and `catch`, ignored with `.catch(() => null)` when the value is not needed, and branched on with the typed error classes (`ProviderError`, `HttpError`, `ApiError`).

Why: `T | Error` cannot separate a success from an error value, and a duck-typed `isError` reads ordinary objects as errors. `attempt` returns non-`Error` throws as success, forces `any` in its signature and hides which call failed.

Revisit: only when a flow chains several fallible steps that each need their own message. Then use a discriminated union built from named interfaces, `{ ok: true, value } | { ok: false, error }`, not `T | Error`.

Rejected: `Result<T>`, `isError`, `attempt` and a wrapper that converts every throw into a value.

## 2026-10-25 - Linux turns blur off

Decision: `layout.tsx` sets `data-os='linux'` before first paint from the user agent. `globals.css` removes `backdrop-filter` from every `backdrop-blur` element under that attribute, raises the glass token to a solid color, and offers a `linux:` background for translucent surfaces. A surface that needs blur to read gets that background.

Why: WebKitGTK parses `backdrop-filter`, so an `@supports not` fallback never fires, then renders the blur wrong or not at all depending on GPU, compositing mode and version. Popovers at 75% opacity over content ghost, and low-alpha chips disappear. Detecting the platform once beats a feature query that lies.

Rejected: an `@supports not (backdrop-filter: blur(1px))` fallback, a user-agent hack per component, and a runtime class toggle.

## 2026-10-25 - Ternaries carry one simple choice

Decision: a ternary is allowed only as `const name = test ? a : b`. The test is one simple check, branches are plain values. Components are never rendered through a ternary, use `&&`, an early return or a component variable (`const Icon = isOn ? A : B`). `TERNARY_SELECTORS` enforces the rule in `src`, tests stay exempt.

Why: a JSX or call branch hides a second code path inside an expression, and the selector keeps each choice named.

Rejected: nested ternaries, ternary JSX and ternary branches that compute.

## 2026-10-25 - Callback props keep their name

Decision: a callback prop passed down stays `props.onAction` at the use site. A function created in the component and passed to an `on*` prop is named `handle<Action>`. An existing function (setter, store action, `props.onX`, an import) is passed directly. A callback is destructured only when every use sits inside a hook callback, where `props.onX()` would make `props` the dependency. A store selection is named after the action (`clearSelection`) and passed directly.

Why: renamed aliases add a second name for one function, and the destructuring exception stays limited to the dependency-array case.

Rejected: `const handleClose = props.onClose`, destructuring renames and handler names on store actions.

## 2026-10-25 - `jsx-no-bind` off

Decision: `react/jsx-no-bind` is off. `INLINE_FUNCTION_SELECTORS` bans arrow and function values in JSX attributes, and a plain `const handleX = () => ...` is the default.

Why: `jsx-no-bind` also reported a named handler declared in the component, which forced `useCallback` on every handler. The selector covers the inline case without forcing memoization.

Rejected: `jsx-no-bind` with `allowArrowFunctions`, and `useCallback` as the only way to pass a handler.

## 2026-10-25 - `Branded` ids deferred

Decision: id types stay plain strings for now. Adopt a `Branded` type with the next data-model change.

Why: upload, generation and folder ids are uuid strings, so branding would catch mix-ups, but it touches every id in schemas, repos, `lib/api`, stores and tests. That is a big diff with no bug on record.

Rejected: branding now, and a partial brand on one id family.

## 2026-10-25 - Composition root in `server/boot.ts`

Decision: `bootServer()` acquires the instance lock, starts secrets without blocking, wires the submit queue and job events, starts the poller and parent watch, then checks ffmpeg. `instrumentation.ts` only guards the runtime and calls it.

Why: one ordered startup path, and no side effects at module load in jobs.

Rejected: side-effect imports and dynamic imports scattered through server modules.

## 2026-10-25 - Services layer

Decision: `src/server/services` orchestrates adapters, repos, media and sync for routes and jobs. It holds `credits`, `model-catalog`, `remote-inputs`, `upload-probe`, `uploads` and `connection-test`.

Why: routes stay thin, jobs keep one dependency direction, and provider and storage adapters never import services.

Rejected: route handlers reaching into provider or storage internals.

## 2026-10-25 - Provider bindings

Decision: a preset holds `bindings` in priority order. Each binding has `provider`, `modelId`, `pricing` and `transport`. The first binding whose provider is configured wins. The record stores the chosen provider and model id at submit time.

Why: route-specific data leaves the model definition, and several providers can serve one catalog.

Rejected: one OpenRouter id and pricing table on the preset.

## 2026-10-25 - Availability-only runtime catalog

Decision: `/api/models` uses live provider data only for availability and pricing. Presets stay the source of durations, resolutions, references and limits.

Why: feature code reads presets synchronously, so live capability narrowing would push async state through the store. Drift is caught offline by `tests/catalog-live.test.ts`.

Rejected: runtime capability narrowing from provider model lists.

## 2026-10-25 - No cross-provider fallback after a failure

Decision: a failed submit or poll never retries on another binding. A new generation is the only way to switch providers.

Why: a failed submit can still be billed, so a silent retry on another provider can bill twice.

Rejected: automatic fallback across provider bindings.

## 2026-10-25 - Flat types with named parts

Decision: every object type is one level. Nested shapes become named interfaces, owner-prefixed when the part belongs to one owner (`RecordJob`, `RecordOutput`), and shared names when the shape repeats (`PixelSize`, `FrameSlots`). No inline `z.object` inside another schema.

Why: named parts are readable, reusable and testable. `no-restricted-syntax` enforces the rule in `src`, tests stay exempt.

Rejected: inline object literals for parameter bags, return types and nested schema fields.

## 2026-10-25 - Stored data schemas without version fields

Decision: files on disk parse through `src/core/schemas` with `safeParse`. Stored JSON changes are additive, new fields are optional or have a zod default. No version fields today. A file without a version is version 1, the first breaking change adds `schemaVersion: 2` and a migration next to the schema. An invalid file is skipped and logged, never thrown.

Why: every change on the horizon is additive, and a version added later costs nothing. Older files keep parsing and users move forward.

Rejected: `JSON.parse(text) as T` and silent casts. A version field before the first breaking change.

## 2026-10-25 - Updates run in Rust

Decision: the Tauri shell checks for, downloads and installs updates with `tauri-plugin-updater`. The webview calls five commands: `update_info`, `update_check`, `update_install`, `update_set_auto` and `update_open_release`.

Why: the webview never gets the updater permission or the signing key. The shell stops the Node server before it replaces the app, so no job writes into a bundle that is being swapped. Every download is checked against the public key embedded in `tauri.conf.json`, and the `latest` endpoint skips drafts and prereleases until they are published.

Rejected: an in-page updater (needs the webview permission and a server stop from the wrong side), and manual downloads for every release.

## 2026-10-25 - R2 storage cap of 8 GB with eviction

Decision: `REMOTE_MAX_GB` is 8. A put that would pass the cap first removes the oldest keys whose `lastUsedAt` is past the 2 hour link TTL, then fails with `RemoteCapError` when nothing evictable frees enough room.

Why: Cloudflare has no hard spend cap and needs a card. Tracking the app's own objects keeps usage under the free 10 GB.

Rejected: listing the bucket to measure usage, and a lock per put. Two parallel uploads may both pass, and the 2 GB headroom covers that.

Superseded in 0.3.1 for the listing and lock parts, see 2026-10-28 - R2 cap reads the bucket listing under a lock.

## 2026-10-25 - User guides in `docs/user`, linked from Settings

Decision: setup guides for OpenRouter and Cloudflare R2 live in `docs/user`, one file per service. Settings links the exact guide page and the README links the same files.

Why: the README stays short, the guides carry screenshots, and the app sends the reader to the page they need.

Rejected: one long setup section in the README, and help text in the app that duplicates the guides.

## 2026-10-25 - Shared unions from const arrays, no `enum`

Decision: a string union that is validated, iterated, stored or sent over HTTP or IPC comes from one `as const` array. The type is `(typeof LIST)[number]` and schemas use `z.enum(LIST)`.

Why: one list feeds the type, zod and loops, and nothing is emitted at runtime.

Rejected: a TS `enum`, which adds runtime code and uses nominal strings, and a second list for zod.

## 2026-10-25 - Runtime copy stamped by build id

Decision: the shell stages the bundled server into a per-version runtime dir once. A `.upai-build` stamp holds the bundled build id, and a runtime copy whose stamp differs is replaced.

Why: a same-version rebuild served a stale frontend before the stamp.

Rejected: copying the server on every launch, and trusting the version folder alone.

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

Superseded in 0.3.0, see 2026-10-27 - Live picker selection and docked panel.

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

## 2026-10-20 - Review follow-ups

- Tab normalization runs `inputForSubmit` on submit and server side, and history thumbs render only the record's tab.
- Boot reconcile no longer expires by age. A job expires only on OpenRouter expired, 404, or a passed `expires_at`.
- Local API guard requires matching Host, Origin, Sec-Fetch-Site and a JSON content type, or answers 403/415.
- Model picker options come from `VIDEO_PRESETS`, and prices use live SKU rates with a saved fallback.
- Price shows in the Resolution popover, the model picker and the Generate button. Discounted prices show the struck list price and the percent off.
- Adding a video reference clamps duration to the preset combined input plus output limit, with a toast.
- Known literal labels in stored or pasted prompts become mention chips.
- Picker thumb URLs carry a file stamp version so replaced uploads refetch their thumb.
- Upload delete removes the file and every generation link that references it.
- Global CSS removes focus outlines. Keyboard state relies on hover/focus styling instead.
- Credits hint says "management key" instead of the env var name so no OPENROUTER string ships in the client bundle.

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
