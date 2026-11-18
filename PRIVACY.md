# Privacy

Last updated: 2026-11-16

Chordifree has two modes. This document describes both.

- **Local / desktop:** no accounts, no Chordifree-operated server and no cloud library.
- **Private online instance (optional):** the owner hosts Chordifree on Google Cloud and
  restricts access to approved Google accounts. The library can be stored per user in
  Firestore.

## Local and desktop mode

- The song library, saved analyses, practice settings, theme and language preference are
  stored in `localStorage` on the device, or in the desktop app's local data directory.
- Nothing is uploaded to a Chordifree server unless you choose to analyze something and a
  local server is running.
- You can remove everything from the app, delete site data in the browser, or use the
  export/import JSON tools.
- The desktop build bundles the analyzer; it does not require an account.

## Private online instance

An online instance is operated by the person or organization that deploys it, not by the
Chordifree authors. That operator chooses the Google Cloud project, the OAuth client and the
allowlist.

### Access and identity

- Sign-in uses Google Identity Services. The browser receives a Google ID token and sends it
  to the Chordifree API as a Bearer token.
- The server verifies the token with Google and reads the Google subject (`uid`), email and,
  when present, name and picture.
- The allowlist is stored in Firestore at `chordifree_access/{email}` with the email, the
  date it was added and, optionally, which administrator added it.
- Administrators are configured with `ADMIN_EMAILS` and are always allowed. They can add or
  remove other accounts from the Administration page.
- The optional nickname is stored in `chordifree_profiles/{uid}` and is shown on the
  collaborations you edit. Without a nickname, the account menu uses the name and picture
  returned by Google.
- The ID token is kept in `sessionStorage` for the browser tab session. It expires after
  about an hour; the app asks you to sign in again.

### Library and account data

For an approved account, the online library is stored in the operator's Firestore database:

- `chordifree_users/{uid}/songs/{songId}`: the song, including chords, lyrics, detected
  segments, transposition, capo and notation preferences.
- `chordifree_users/{uid}/setlists/{setlistId}`: setlists and their ordered song IDs.

Shared songs are stored separately:

- `chordifree_shared/{shareId}`: the owner, the original song ID and the current version.
- `chordifree_shared/{shareId}/revisions/{revisionId}`: one snapshot of the song per save,
  with the author's nickname and the date. The last 100 versions are kept.
- `chordifree_profiles/{uid}`: the optional nickname.

Anyone signed in to the instance who has the link can read those versions and publish new
ones. Deleting your cloud data also deletes the shares you own and your nickname; versions
published in someone else's share stay there with your nickname. The versions contain chords,
lyrics and metadata, never audio.

Practice history, the active A–B range, the playback position, the theme, the language and
the local analysis cache stay in the browser/device. They are not part of the cloud
snapshot.

The browser keeps a local copy and merges it with the cloud snapshot by song source and
`updatedAt`. If the cloud is unavailable, the local copy remains usable.

### What is not stored

The application does not intentionally store audio files or the Google ID token in
Firestore. Temporary audio is written to the container's temporary directory and removed when
the job finishes or by the cleanup job. The in-memory job store keeps job metadata and
analysis results for up to 24 hours or until the process restarts. Lyrics fetched from a
provider are inserted into the editor as a draft; if the user saves them, they become part of
the saved song.

### Administrators and operators

- Administrators can list, add and remove allowlist entries.
- The application has no endpoint that lets one user read another user's library.
- The operator of the Google Cloud project can access Firestore, Cloud Run logs and the
  Terraform state through Google Cloud. Treat the operator as trusted.
- If you remove an account from the allowlist, it can no longer sign in, but its existing
  library is not deleted automatically.

### Deleting your cloud data

From the account menu, **Delete cloud data** removes the signed-in user's songs, setlists,
nickname and owned shares from Firestore. If the account is not an administrator, its allowlist entry is removed too;
administrators keep access because they are declared in `ADMIN_EMAILS` and may need to keep
managing the instance.

The local copy on the device is not deleted by that action. To remove it, clear the app's
site data or delete the desktop app's local data.

### Optional YouTube extractor

An operator may run the optional `services/youtube-extractor` on a residential connection.
In that case:

- The Cloud Run server sends the YouTube video ID to the extractor over HTTPS with a shared
  token.
- The extractor downloads the audio and returns it to the server for analysis.
- The extractor removes its temporary files after the response.
- The extractor's operator can see its own request logs and the video IDs it processes.
- The extractor token is a secret. It is stored in the extractor environment and in the
  Terraform state of the online instance.

If no extractor is configured, the server uses `yt-dlp` directly. YouTube may block
datacenter/Cloud Run IPs; the audio-upload path avoids YouTube entirely.

## Third parties

- **Google Identity:** verifies the Google account used to sign in.
- **Google Cloud (optional online mode):** Cloud Run, Firestore, Artifact Registry, Cloud
  Build and Cloud Logging host the instance and its data.
- **YouTube / `yt-dlp`:** used when you analyze a YouTube link or search by name. Their terms
  and privacy policies apply. Downloading YouTube audio may violate YouTube's Terms of
  Service.
- **LRCLIB:** used when you request lyrics. The song title, artist and duration are sent to
  LRCLIB.
- **Google Fonts:** the web app loads Manrope and IBM Plex Mono from Google Fonts. Self-host
  the fonts if you need a deployment with no third-party requests.
- **Essentia, YAMNet and the voice/instrumental model:** see the licence notes in the README.

The application does not include analytics, advertising or third-party tracking.

## Logs

The server and analyzer write operational logs: HTTP status, analysis errors, job IDs, video
IDs, container health, and the account-deletion summary. They do not intentionally log audio
content, lyrics, Google ID tokens or passwords. Configure log retention and access according
to your deployment. Cloud Run and Cloud Logging retention is controlled by the Google Cloud
project.

## Backups

The Terraform stack does not configure Firestore backups. The operator is responsible for
exports, retention and disaster recovery. `terraform destroy` leaves the Firestore database
in place (`deletion_policy = "ABANDON"`), but that is not a backup.

## Changes

This document describes both the local-first default and the optional private online mode.
If an operator adds payments, analytics or another storage provider, that operator must update
this policy and provide the corresponding consent and retention controls.
