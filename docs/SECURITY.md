# Security

## 1. Scope

Single user, local app on macOS, Windows and Linux. It is not a server for a network and must not be exposed through a proxy, tunnel or port forward.

## 2. Assets

| Asset | Where it lives |
|---|---|
| OpenRouter keys | macOS Keychain, Windows Credential Manager, Linux Secret Service, or `secrets.json` (0600) on Linux when no keyring exists |
| R2 credentials | Same as above |
| Prompts and media | `~/.unplatform-ai` and requests to OpenRouter or R2 |
| Generated videos | `~/.unplatform-ai/downloads` |

## 3. Threats and controls

| Threat | Control |
|---|---|
| A website calls the local API (CSRF, DNS rebinding) | Host allowlist (`127.0.0.1`, `localhost`, `::1`), `sec-fetch-site` and origin checks on writes, JSON content type required |
| A website frames or embeds the app | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy` on API routes |
| Another local program calls the API | Per-launch token from a 0600 file in desktop mode, or a browser token minted at boot and stored at `$STORAGE_ROOT/browser-session` (0600). Then an HttpOnly, SameSite=Strict cookie checked on every route except health and session |
| Another OS user reads app data | Data folder created with mode 0700 on macOS and Linux. Windows relies on the user profile ACL because 0700 has no meaning there. The 0600 `secrets.json` fallback is Linux only. |
| Keys leak into the page or logs | Secrets stay server-side, status exposes only the last four characters, logs name keys but never values or presigned URLs |
| Path traversal in media or folder routes | `safe-path` resolution under the allowed root, UUID ids. Export routes write only to a path or folder from the native save dialog, desktop only, after an absolute path check, a real directory check, and symlink and non-file rejection. Copies are exclusive, and a single-file export overwrites only a path the server save dialog returned in the last 10 minutes, once. |
| The webview gains native powers | Dialog, notification and opener permissions. The opener allows `https://openrouter.ai/*`, `https://dash.cloudflare.com/*` and `https://github.com/jefoce/unplatform-ai*`. Five `update_*` commands are allowed through the app manifest. A runtime capability grants the sidecar origin only, for the exact bound port. The page has no `updater:*` or `process:*` permission. |
| A provider-supplied URL reaches an internal service | `safeFetchProviderUrl` accepts https only, an exact host or subdomain of `provider.contentHosts` (`openrouter.ai`), then resolves the host and rejects loopback, private, link-local, CGNAT, multicast and unspecified addresses. At most 3 redirects, each checked again. |
| A tampered Node runtime at build | Pinned source checked against NODE_SHA256 in scripts/node/versions.env, the official binary fallback is checked against SHASUMS256.txt |
| A tampered ffmpeg source at build | Pinned SHA-256 per archive, a nonfree guard on the profile, `scripts/ffmpeg/verify.sh`, and the three source archives attached to every release. Sources are also published in a public GHCR package. |
| A tampered sidecar artifact | Sidecars come from public GHCR packages. Only this repository's token can push, every pull verifies the binary sha256 against manifest.json and runs scripts/ffmpeg/verify.sh or scripts/node/verify.sh. Existing tags are not overwritten unless force_rebuild_sidecars is set. |
| A tampered prebuilt sidecar in staging | The extracted binary is chmod +x, its manifest sha256 is checked, and verify.sh runs before packaging. Native packages are copied whole and ad-hoc signed on macOS. |
| A tampered update or a downgrade | `latest.json` comes over HTTPS and is not signed, but each installer carries a signature checked against the embedded public key. A changed manifest can only point at files that fail the check. The plugin installs only a newer version. `UPAI_UPDATE_ENDPOINT` changes which manifest is read, never the key. |
| Reference images leak location or camera data | Every image is re-encoded before sending and EXIF metadata is dropped |
| Provider content checks | Prompts and references go to OpenRouter and the model provider, which run their own content checks. Seedance blocks realistic faces. Nothing is sent before Generate. |
| Remote media links leak | Presigned links are short lived and scoped to one object, 2 h by default |

The webview never receives key material. In desktop mode the Node server asks the Rust shell for secrets over stdin/stdout, so keychain calls happen in the signed app process.

The app CSP is built once in `src/lib/csp.ts` (`buildAppCsp`). `src/proxy.ts` attaches it with a fresh nonce per document, and `tauri.conf.json` repeats the same policy for the splash page.

## 4. Updates

`latest.json` comes over HTTPS from GitHub and carries one signature per installer. It is not itself signed. The shell checks the downloaded installer against the Ed25519 public key embedded in `tauri.conf.json`, so a changed manifest can only point at files that fail the check. The plugin installs only a version newer than the running one. A download that fails the check is rejected, and the update stops the server and restarts the app. `UPAI_UPDATE_ENDPOINT` changes which manifest is read, never the key.

The private signing key lives only in the GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` and in the owner's password manager. It is never in the repo or on a build runner outside a release job.

A lost or leaked key cannot be replaced for an installed app, because the embedded public key is fixed at build time. Every user must then reinstall by hand from the Releases page. Keep a backup of the key.

## 5. Known limits

- The app is ad hoc signed. macOS can show Keychain prompts again after a rebuild or update, and Gatekeeper needs the first-open bypass. A Developer ID signature is planned. See [DEVELOPMENT.md](DEVELOPMENT.md).
- The session cookie is host-only (no `Domain`), `HttpOnly` and `SameSite=Strict`. `Secure` is omitted because the origin is plain http on `127.0.0.1`, so the cookie cannot leave the host. The token travels in the URL fragment, which browsers never send, then a page POSTs it to `/api/session` and replaces the URL with `/`.
- Browser mode mints a token at boot, stores it at `$STORAGE_ROOT/browser-session` with mode 0600, and prints the session URL on every start. A restart keeps the same cookie. Any local process that can read that file or the output can use the token. Use browser mode for development only.
- Presigned R2 links work for anyone who has the URL until they expire. The app never logs them, but a copied URL is a valid read for the link lifetime.
- If Linux has no keyring service, keys fall back to `~/.unplatform-ai/secrets.json` with mode 0600. File permissions, not the OS keyring, protect that file. macOS and Windows do not use the file fallback.
- The R2 token can read and write the configured bucket. Create a token scoped to that bucket only.

## 6. Reporting

Security problems: use GitHub private vulnerability reporting (Security tab, "Report a vulnerability"). Normal bugs: open an issue. Do not include keys, account ids, presigned URLs or private media in the report.
