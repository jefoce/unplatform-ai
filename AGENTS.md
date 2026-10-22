# AGENTS.md

Rules for coding agents working in this repo. Setup, scripts and how-tos are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Before saying done

```bash
pnpm typecheck && pnpm lint && pnpm deps && pnpm format:check && pnpm knip && pnpm test && pnpm build
```

- Also run `pnpm desktop:build` and `pnpm smoke` when touching `src-tauri`, `scripts/`, `next.config.ts` or anything the sidecar loads.
- Before reporting that a UI change works or that a UI bug exists: `rm -rf .next`, check in `pnpm dev`, and rebuild the desktop bundle for desktop checks. A stale cache already caused one false bug report.
- Report what was verified and what was not. Measured numbers say "measured", guesses say "estimate".

## Git

- Work on the branch named after the next version, without `v` (`0.1.1`). Create it locally if it does not exist. Never commit to `releases`.
- The first commit on a new branch bumps the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `Cargo.lock`, and opens `## X.Y.Z - unreleased` in `CHANGELOG.md`.
- The pull request and its squash commit are titled `X.Y.Z`, where `X.Y.Z` matches `package.json`. The release workflow creates `vX.Y.Z` when the squash merge reaches `releases`.
- Commit messages: `X.Y.Z: <what>`. One commit per item. Bulk tool runs (`lint --fix`, `prettier --write`, codemods) get their own commit.
- Before 1.0: patch for fixes only, minor for features, behavior changes or file format changes. Propose the bump in the report.
- Never push, force push, tag, create releases, open pull requests or change remotes unless the user asks for that exact action in the current message.
- Before saying done: `git status` is clean except untracked review files, and the report lists the branch and commit hashes.

## Hard rules

- No `process.env` reads of key values outside `src/server/secrets`. Use `getSecret()` after `awaitSecrets()`.
- No `@tauri-apps/*` imports outside `src/lib/platform/desktop.ts`.
- Every API route calls `assertLocalRequest` before work. Health and session opt out of only the session check.
- Never log secrets, full keys, presigned URLs or account ids. Status may show the last four characters.
- `src/core` imports nothing from `server`, `features` or `lib`.
- Bounds and tunables live in `src/core/constants.ts`. Docs tables are tested against them.
- Model data lives in `src/core/presets/<family>/<model>.ts`. No code outside `src/core/presets` branches on a preset id, slug, title or family. Lint enforces it.
- Error texts and hints describe the current model only. Never suggest a specific other model.
- Change a preset only with a source link (provider docs or a real-key test) in the commit message and in a comment next to the value.
- Do not add a dependency for something the stdlib or an installed package already does.
- No focus rings. Keyboard focus uses the `:focus-visible` hover UI, never `focus-visible:ring-*`. Mouse clicks do not leave buttons focused (`usePointerBlur`), menus excepted.

## Mock first

- `OPENROUTER_MOCK=1` for any change that touches generation. Mock jobs cost nothing and cover pending, in progress, completed and `[fail]`.
- `REMOTE_MOCK=1` replaces R2 locally.
- One suite: `pnpm vitest run tests/your-file.test.ts`.
- Real-key runs only when asked. Say which preset, settings and inputs were used.

## TypeScript

- No `any`. Use `unknown` plus a zod schema or a type guard.
- Data from outside (OpenRouter responses, request bodies, JSON files on disk, localStorage) is parsed with zod. Types come from `z.infer`, never hand-written next to a schema.
- One type per API shape, in `src/core`, imported by both the route and the client. No copies of a response type in a component.
- `satisfies` for literal config objects (presets, tables). `as const` for fixed lists.
- No nested ternaries. Branch on simple values only (identifier, literal, member access, template string, JSX, `null`, single-argument call). A function, object, array, `await`, assignment or nested ternary in a branch becomes a named handler, variable or early return.
- Boolean variables and params start with `is`, `has`, `can`, `should` or `did`. Types are PascalCase. Module constants are UPPER_CASE or camelCase.
- Zod schema constants keep PascalCase names (`QuerySchema`), even though other module constants are camelCase or UPPER_CASE.
- Required props and fields stay required. Do not make a value optional and then guard against undefined downstream.

### Value checks

Use `lodash-es` predicates instead of raw comparisons:

| Check                                 | Use                     | Not                                                       |
| ------------------------------------- | ----------------------- | --------------------------------------------------------- |
| null or undefined                     | `isNil(x)`, `!isNil(x)` | `x == null`, `x != null`, `x === undefined`, `x === null` |
| empty array, string, object, Map, Set | `isEmpty(x)`            | `x.length === 0`, `Object.keys(x).length === 0`           |
| string                                | `isString(x)`           | `typeof x === 'string'`                                   |
| boolean                               | `isBoolean(x)`          | `typeof x === 'boolean'`                                  |
| function                              | `isFunction(x)`         | `typeof x === 'function'`                                 |
| plain object                          | `isPlainObject(x)`      | `typeof x === 'object' && x !== null`                     |

Traps, do not use these:

- `isEmpty` on numbers or booleans. It returns `true` for every number.
- `isNumber`. It returns `true` for `NaN`. Use `Number.isFinite(x)`.
- lodash `isFinite` under its own name. It reads like the unsafe global. Use `Number.isFinite`.
- `isNil(window)`. An undeclared global throws. Keep `typeof window === 'undefined'` for SSR guards.

Still fine: `?.`, `??`, and `Boolean(x)` on the left of `&&` in JSX.

`isPlainObject` does not narrow the type. Where narrowing is needed (`isRecord` in `server/openrouter/client.ts`), keep one typed guard in `src/core/guards.ts` and import it. No local copies.

### Parameters

- Up to 2 arguments: positional.
- 3 or more: one object named `params` with an exported or local `interface <Name>Params`. Destructure on the first line of the body, never in the signature.

```ts
interface CopyUniqueParams {
  source: string
  dir: string
  base: string
}

async function copyUnique(params: CopyUniqueParams): Promise<string> {
  const { source, dir, base } = params
  // ...
}
```

- Components follow the same rule with `props`: `function HistoryRow(props: HistoryRowProps)`, then `const { record } = props` on the first line.
- Hooks with 3 or more inputs take `params` too (`useVideoState(params)`).
- Exceptions: callbacks with a fixed signature (event handlers, `map`/`filter`/`reduce`, zustand `set`, `Array.sort`), route handlers (`request`, `{ params }` from Next), and tiny private helpers where the call reads like math (`clamp(value, min, max)`).

## React

- Function components and hooks only.
- One component per file, including private rows and badges. The file name matches the main export. Files stay near 200 lines, split by component or job, never by squeezed formatting.
- `'use client'` only in files that use state, effects, browser APIs or event handlers.
- Props type is `interface <Component>Props`. Export it only when another file uses it.
- zustand: always subscribe with a selector, `useStore((state) => state.x)`. Never `useStore()` for the whole store.
- Server data goes through SWR with keys from `src/lib/swr-keys.ts`. No `fetch` inside `useEffect` for data SWR can own.
- Browser storage only through `src/lib/local-store.ts` (try/catch plus zod). Never `localStorage` directly.
- Toasts (`sonner`) only in `src/features`. `src/core` and `src/server` never show UI.
- Icon-only buttons have `aria-label`. Decorative lucide icons have `aria-hidden`.
- Card and row click handlers start with `isOwnEvent(event)`. Portal content (menus, popovers, dialogs) bubbles through React.

### Event handlers

- A function defined in a component and passed to a prop or element event is named `handle<Action>`: `handleDownload`, `handleSelect`, `handleOpenChange`. Use the action, not the DOM event: `handleDelete`, not `handleClick`.
- Props that take a callback are named `on<Action>`: `onOpen`, `onCancel`, `onDeleted`.
- Pass through as `onDelete={handleDelete}`. A prop that receives a parent's callback unchanged can pass `onOpen={onOpen}`.
- Never inline a function in JSX. Every `onX` gets a named `handle<Action>`. A row that needs the item receives it as a prop and defines `handleSelect` inside. Do not write curried `handleSelect(id)` factories.
- No arrow or function values as object properties inside components. Name the function and pass it by reference. Arrows passed as call arguments (`useEffect`, `.map`) stay.
- Store actions passed to an event get a handler name at the selector: `const handleClear = useSelectionStore((state) => state.clear)`.
- `react/jsx-handler-names` enforces the `handle` and `on` prefixes and leaves inline arrows alone.

### useCallback and useMemo

- No React Compiler, so `useCallback` only helps when identity matters. Use it when:
  1. The function goes to a child wrapped in `memo()`.
  2. The function is in a dependency array (`useEffect`, `useMemo`, another `useCallback`).
  3. A custom hook returns the function. Consumers may put it in their deps.
  4. The function goes to a third-party hook or component that documents a stable identity requirement.
- Everywhere else, a plain `const handleX = () => ...`. `react-hooks/exhaustive-deps` catches missing deps in cases 2 and 3.
- Same rule for `useMemo`: objects or arrays passed to a `memo()` child or a dependency array, and calculations measured as slow. Not for cheap values.

### Conditional rendering

- Render-or-nothing uses `&&`, not a ternary with `null`:

```tsx
{
  record.favorite && <HeartButton record={record} />
}
```

- `&&` needs a boolean on the left. A number or string uses `> 0` or `Boolean(x)`. Never `!!`.

```tsx
{
  selected.length > 0 && <SelectionBar records={records} />
}
{
  Boolean(poster) && <img src={poster} alt="" />
}
```

- A ternary only when both branches render something: `{completed ? <LazyVideo /> : <StatusOverlay />}`.

## UI building blocks

- Before writing a new component, hook or helper, search `src/ui`, `src/ui/form`, `src/lib` and the feature folder. Reuse it, or extend it with a variant.
- New buttons, popovers, modals, tooltips, sliders and fields use `src/ui`. A raw `<button>` is fine only for overlay icon controls that share one class constant.
- Single-choice pickers close on pick. Multi-toggle panels (Filter) stay open until click outside or Escape.
- `<img>` is correct for posters and thumbs from `/api/thumbs` and `/api/media` (already sized by the server). Keep the eslint-disable with its reason. Do not switch them to `next/image`.

## Styling

- Tailwind v4 with tokens from `@theme` in `src/app/globals.css`. Merge classes with `cn()` from `src/lib/cn.ts`.
- Scale first. Tailwind v4 has a number class for every multiple of 4 px (`max-h-50` = 200 px, `w-70` = 280 px). Never write `[Npx]` when a scale value exists.
- Token second. A value that repeats, or that has a meaning (panel width, card radius, a breakpoint), goes into `@theme` in `src/app/globals.css` and is used by name:
  - `--spacing-<name>` gives `w-<name>`, `h-<name>`, `p-<name>`, `gap-<name>` and the rest.
  - `--radius-<name>`, `--text-<name>`, `--color-<name>`, `--shadow-<name>`, `--breakpoint-<name>`.
- Arbitrary values last, only for what the scale and tokens cannot say: `calc()`, `var()`, gradients, grid templates, and selector variants like `group-has-[...]/card`.
- Colors only through tokens. No `[#hex]`, no `[rgb(...)]`.
- A repeated set of classes becomes a component in `src/ui`, or a `*_CLASSES` constant next to its component. Not `@apply`. `@utility` only for things Tailwind has no utility for (scrollbar styling, for example).
- A value used both in JS (inline `style`, measurements) and in classes lives in `src/core/constants.ts` only, and the class side uses the inline style. Do not keep two copies.
- Do not restate defaults (`flex-row`, `static`, `font-normal` on plain text).
- Named groups (`group/card`, `group/player`) when a `group` sits inside another `group`.
- Hidden overlays are not rendered, or are `pointer-events-none`. Nothing invisible may catch hover or clicks.

## Server

- Every file in `src/server` starts with `import 'server-only'`.
- Route handlers: `assertLocalRequest`, then `safeParse` with zod and `zodError` on failure, then work. Errors go through `errorResponse`. Throw `HttpError` for expected failures.
- Long work never runs inside a route handler. Queue it in `src/server/jobs`.
- Record writes go through the per-record lock (`withLock`). Never read-modify-write a record without it.
- Provider error text is stored raw. Translation to plain words happens at render time (`core/provider-errors.ts`).

## Style

- Terse. Short sentences. No hype, no filler, no em dashes in prose or comments.
- Comments explain why, not what. JSDoc for block docs, inline notes only inside a function.
- Early returns over nested branches. Lookup tables over if/else chains that only return.
- Blank lines group code: declarations together, one blank line before and after every block, before `return`, and before functions, types and exports. No blank line at the start or end of a block.
- Formatting is Prettier's. Never hand-format or work around it. Import order is ESLint's (`simple-import-sort`).
- Smallest diff that solves the problem. No drive-by refactors outside the files you touch.
- Fix every rule violation in the files you touch in one pass, not only the line you changed.
- Never squeeze formatting (joined lines, removed blank lines) to hit a line count. Split the file instead.
- Use the package the file already imports. `lodash-es` is available in both trees.
- Never put review item ids (`C6`, `v20`, `L17`, `A1`, `B3`, `K0`) in code, test names, comments, docs or commit messages. Describe the behavior instead. Review ids live only in review files.

## Where to look

| Topic                                                                                                 | Document                                     |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Setup, scripts, mock modes, desktop build, ffmpeg and Node builds, adding a model, debugging, release | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)   |
| Runtime, data model, lifecycle, concurrency, bounds, edge cases                                       | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Threat model and controls                                                                             | [docs/SECURITY.md](docs/SECURITY.md)         |
| Why a design exists                                                                                   | [docs/DECISIONS.md](docs/DECISIONS.md)       |
| User-facing behavior                                                                                  | [README.md](README.md)                       |

## Quick map

- Routes: `src/app/api`
- Jobs: `src/server/jobs` (`submit-queue`, `run-submit`, `submit-media`, `submit-record`, `poller`, `download-queue`, `generation-actions`)
- Repos: `src/server/repos`
- Media: `src/server/media` (`ffmpeg`, `to-data-url`, `thumbs`, `compat`)
- Presets: `src/core/presets` (one file per model, `index.ts` holds the list)
- History: `src/features/history` (`record-view` helpers, `record-actions`, `selection-store`, `view-store`)
- Validation: `src/core/validation.ts`
- Provider errors: `src/core/provider-errors.ts`
- Secrets: `src/server/secrets`
- Platform bridge: `src/lib/platform`
- Shared UI: `src/ui`, `src/ui/form`
- Desktop shell: `src-tauri/src`
- ffmpeg build: `scripts/ffmpeg`
- Node build: `scripts/node`
- Workflow helpers: `.github/scripts`
