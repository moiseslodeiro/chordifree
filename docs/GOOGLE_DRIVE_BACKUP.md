# Google Drive backup and sync

Status: **proposal**. Nothing in this document is implemented yet.

## 1. Goal

Let a user connect a Google account to keep an online copy of their Chordifree
library in Google Drive:

- folders and song membership;
- songs, including chord edits, lyrics, capo, transposition and notation;
- setlists;
- preferences (optionally);
- deletions, so a removed song does not come back on the next sync.

The app keeps working without an account. Drive is a mirror, never the primary
store.

### Non-goals

- Real-time collaborative editing.
- Sharing a library between different users.
- Using Drive as the app's database.
- Storing analysis audio, caches or playback history remotely.

## 2. Current state

- The library lives in `localStorage` under `chordifree:v1:*` envelopes:
  library, individual songs, setlists, preferences and history.
- Songs and setlists already have stable `id` and `updatedAt` fields.
- The current JSON backup (`apps/web/src/storage/backup.ts`) only contains
  songs (`version: 1`). Folders do not exist on `main` yet; they are introduced
  by the library-folders branch.
- There are no tombstones, so a deletion cannot be distinguished from a song
  that was never uploaded.
- The web build is static (GitHub Pages). The analysis server is only a local
  helper; there is no backend that could keep OAuth secrets or refresh tokens.
- The desktop build is Electron and can own a secure token store.

## 3. Recommended architecture

```text
React UI
  └── BackupService
        ├── LocalLibrary  (localStorage, existing storage modules)
        ├── BackupSerializer  (schema v2, validation, migrations)
        ├── SyncEngine  (schedule, queue, merge, conflicts)
        └── DriveProvider
              ├── Web: Google Identity Services token client
              │        (access token in memory only)
              └── Electron: main process OAuth loopback + PKCE
                       (refresh token in safeStorage)
        └── Google Drive REST API v3
```

No new backend for the first version. The Drive client should use plain
`fetch`; there is no need to add `gapi`.

## 4. Authentication

### 4.1 Web (GitHub Pages)

Google does not support the authorization-code + PKCE flow for public "Web
application" clients without a client secret, and a pure SPA cannot keep a
refresh token safely. The realistic option is therefore:

- `google.accounts.oauth2.initTokenClient` (Google Identity Services);
- `drive.file` scope (see below);
- access token kept **in memory only**, never in `localStorage`;
- token lifetime is about one hour, so the UI exposes a **Reconnect** action
  when it expires;
- automatic backup runs while the token is valid; otherwise the user can press
  **Back up now**.

If silent, long-lived web backup becomes a hard requirement, the only clean
option is a small backend-for-frontend (serverless function) that holds the
client secret and refresh token. That adds infrastructure and moves token
custody to a server, so it is deliberately out of scope for v1.

Do **not** embed a web client secret in the SPA or exchange codes from the
browser.

### 4.2 Desktop (Electron)

- Create a separate OAuth client of type **Desktop app**.
- Open the system browser with a loopback redirect:
  `http://127.0.0.1:<random-port>/oauth2callback`.
- Use PKCE (`code_verifier` / `code_challenge`) and a random `state`.
- Exchange the code in the Electron main process.
- Keep the refresh token encrypted with `safeStorage` (OS keychain); keep the
  access token in memory.
- Never use an embedded webview for Google sign-in.

### 4.3 Scopes

| Scope | Access | Recommendation |
| --- | --- | --- |
| `drive.file` | Only files created/opened by this app | **Recommended**: visible `Chordifree/` folder, user can recover files |
| `drive.appdata` | Hidden application data folder | Alternative: invisible backup, still in the user's quota |
| `drive` / `drive.readonly` | Broad Drive access | Avoid: restricted scopes, Google verification + CASA assessment |

`drive.file` and `drive.appdata` are non-sensitive scopes, so production needs
brand verification but not a security assessment. While the OAuth consent
screen is in **Testing**, up to 100 test users can connect.

Disclose the scope in the UI, add a privacy policy and allow revocation from
the app and from the Google account page.

## 5. Backup format v2

Extend the existing backup instead of inventing a second format:

```json
{
  "format": "chordifree-backup",
  "version": 2,
  "exportedAt": "2026-11-13T12:00:00.000Z",
  "deviceId": "uuid",
  "songs": [],
  "folders": [],
  "setlists": [],
  "preferences": {},
  "deleted": {
    "songs": ["song-id"],
    "folders": ["folder-id"],
    "setlists": ["setlist-id"]
  }
}
```

Rules:

- Validate every entity on restore, reusing the existing type guards.
- Migrate `version: 1` backups by filling empty folders/setlists/tombstones.
- Add tombstones (or a `deletedAt`) whenever an entity is deleted locally.
- Keep the file human-readable JSON; it is already the export/import format.
- Exclude analysis caches, practice ranges and history to keep snapshots small.

## 6. Sync model

### Phase 1: versioned snapshots (recommended first release)

- Every backup uploads one file:
  `Chordifree/backups/chordifree-<ISO timestamp>.json`.
- Keep the last N snapshots (default 10) and let the user configure retention.
- A manual **Back up now** always creates a new snapshot.
- Automatic backup is debounced (for example 30 seconds after a save) and runs
  at most once per day.
- **Restore** lists snapshots with date, device and song count; the user
  downloads one, validates it and sees a diff preview before applying it.
- Merge by `id` + `updatedAt`. If both sides changed, keep both as
  `Song (local copy)` / `Song (remote copy)` and show a resolution dialog.
- Replace mode is explicit and always offers a local backup first.

This solves the requested use case (online copy of folders, songs, chords and
edits) with a small amount of code and no real-time conflict complexity.

### Phase 2: incremental sync (later)

Only if snapshot size or multi-device conflicts become a problem:

- one file per song (`songs/<id>.json`) plus `folders.json` and
  `setlists.json`;
- compare `updatedAt` and use `If-Match`/ETag to avoid overwriting a newer
  remote version;
- a per-device change queue with retries when offline;
- deletion through tombstones, purged after every device has seen them.

## 7. Google Drive API details

| Operation | Endpoint |
| --- | --- |
| List backups | `GET /drive/v3/files?q=...&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime,size,md5Checksum)` |
| Upload | `POST /upload/drive/v3/files?uploadType=multipart` |
| Download | `GET /drive/v3/files/<id>?alt=media` |
| Delete old snapshots | `DELETE /drive/v3/files/<id>` |
| Storage info | `GET /drive/v3/about?fields=storageQuota` |

- Use `appProperties` to tag files:
  `{ app: "chordifree", schema: "2", deviceId, kind: "snapshot" }`.
- Request the smallest field set possible.
- Errors:
  - `401`: refresh the access token (desktop) or ask to reconnect (web);
  - `403`: missing scope or quota exceeded, show a clear toast;
  - `404`: remote file removed, refresh the list;
  - `429` / `5xx`: retry with exponential backoff and jitter;
  - network offline: keep the change queued and retry later.
- Respect Drive quotas and avoid uploading in a tight loop.

## 8. User experience

Add a **Google Drive** section to the settings/preferences area:

- **Disconnected**: short explanation, scope disclosure, **Connect Google
  Drive**, link to privacy policy.
- **Connected**: account email, last backup time, total size, automatic backup
  toggle, **Back up now**, **Restore**, **Disconnect**.
- **Token expired** (web): **Reconnect** with a non-blocking toast.
- **Restore dialog**: snapshot list, diff summary (new/changed/deleted),
  merge/replace choice, confirmation.
- **First connection**: if remote snapshots exist, offer restore; otherwise
  offer the first backup.
- Success and failure use the existing auto-dismissing toasts, so the layout
  never shifts.
- A small status chip in the library header is enough; do not add a permanent
  banner.

## 9. Security and privacy

- Least-privilege scope; no Drive-wide access.
- Web access token in memory only. Desktop refresh token in the OS keychain.
- PKCE + `state` on every flow; validate the redirect and origin.
- Never log tokens, authorization codes or backup contents.
- Strict CSP in the web build; no third-party scripts on the OAuth page.
- Disconnect revokes the token and removes local credentials; deleting remote
  files is a separate, explicit choice.
- Drive encrypts data at rest, but Google can read it. If lyrics/chords must be
  private even from Google, add optional client-side encryption later
  (AES-GCM with a user passphrase). That adds key-recovery UX and is not part
  of v1.
- Electron: keep `contextIsolation`, disable `nodeIntegration`, validate IPC
  senders and store only the refresh token in the main process.

## 10. Testing

- Unit: backup v2 serialization, validation, v1 migration, merge rules,
  tombstones, PKCE generation, retry/backoff.
- Drive client: mocked `fetch` for list/upload/download/delete and error codes.
- Sync engine: offline queue, debounce, conflict copies.
- E2E: fake Drive provider enabled by an env flag:
  connect → back up → clear local storage → restore.
- Desktop: mocked loopback/token exchange; verify the refresh token never
  reaches the renderer.
- Accessibility: dialogs, menus and focus management.

## 11. Phased delivery

| Phase | Work | Estimate |
| --- | --- | --- |
| 0 | Backup v2 with folders, setlists, preferences and tombstones; migrations | 1–2 days |
| 1 | Web token client, snapshot upload, list and restore UI | 3–5 days |
| 2 | Electron loopback OAuth + `safeStorage` | 2–3 days |
| 3 | Automatic backup, retention, offline queue, error toasts | 2 days |
| 4 | Incremental sync and conflict resolution | 5–8 days |
| 5 | OAuth verification, privacy policy, hardening | 2–3 days |

Phases 0–1 deliver the requested "online copy". Phase 2 makes it seamless on
desktop. Phase 4 is optional.

## 12. Open questions

1. Visible `Chordifree/` folder (`drive.file`) or hidden `drive.appdata`?
   Recommendation: visible folder for user trust and manual recovery.
2. Is a one-hour web session with **Reconnect** acceptable, or is a small BFF
   worth the extra infrastructure for silent web backups?
3. Should backups be end-to-end encrypted from the start?
4. How many snapshots should be retained, and should automatic backup be on by
   default?
5. Include practice ranges and playback history, or keep snapshots limited to
   library data?
6. Folders depend on the library-folders branch; merge that first.
