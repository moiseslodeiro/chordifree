# Chordifree 0.5.1

Install local stem separation from the app, reattach running jobs and harden the server.

## Highlights

- **In-app stems installer (desktop)**: the **Pistas** screen and the song's Audio card can
  install the optional Demucs plugin without leaving the app. It copies the bundled scripts,
  creates a virtual environment in the app data folder and installs CPU PyTorch and Demucs.
  The panel shows the current step, a percentage bar and a console with the real `pip` output;
  the install can be cancelled. The plugin is only marked as available after its imports are
  verified, so a separation can no longer start against a half-installed environment.
- **Uninstall**: the managed plugin can be removed from the song's Audio card or from the
  **Pistas** screen, with a confirmation step.
- **One separation per song**: opening a song reattaches to a job that is already running and
  hides the start button until it finishes. Concurrent requests for the same video now share a
  single job on the server.
- **Cache actions**: cached songs and finished jobs have **Go to song** when the song is in the
  library, and **Download stems** to save every separated WAV in one go.
- **Security**: writes no longer trust an `Origin` that matches an attacker-controlled `Host`
  header (DNS rebinding). Uploads accept exactly one multipart part and no form fields, and job
  payloads from a remote stems service are validated before any file is written.

## Upgrade notes

- The Plugin screen keeps working without changes; existing caches are reused.
- The bundled desktop app does not ship the Demucs model. Install it from **Pistas**; the app
  downloads the dependencies once into its user data folder.
- See `docs/STEMS_PLUGIN.md` for the installer, cache and remote service details.

## Web

The public build at <https://moiseslodeiro.github.io/chordifree/> remains local-only.
Online mode is available when the API and Google OAuth are configured.

## Desktop

The installers are built from the tagged commit. They bundle the local analyzer, ffmpeg and the
ONNX models; the stems plugin is installed from the app, see `docs/STEMS_PLUGIN.md`.

### Windows

- Download `chordifree-0.5.1-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.5.1-arm64.dmg`
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-0.5.1-x86_64.AppImage` or `chordifree-0.5.1-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available yet.

# Chordifree 0.5.0

Karaoke, automatic sections, a multi-track MIDI export and local stem separation on desktop.

## Highlights

- **Karaoke**: a center-channel cancellation toggle in the audio card turns the original track
  into an approximate instrumental. The new karaoke button carries a microphone icon and a blue
  background when it is active.
- **Automatic sections**: the analyzer labels intro, verse, chorus and the rest of the structure,
  and the song view lets you jump between sections while practicing.
- **Multi-track MIDI**: export the chords and pad generated from the analysis together with the
  transcribed bass and drums. On desktop, the bass and drum tracks can come from the separated
  stems instead of the chord transcription.
- **Local stem separation (desktop)**: an optional plugin (Demucs) splits the song into vocals,
  drums, bass and other. The mixer plays the four tracks synchronized, each with its own volume, and
  you can listen to one stem at a time or download each WAV.
- **Stems cache and background jobs**: separations keep running when you change songs or close
  the view, can be cancelled from the song or from the profile screen, and completed results are
  cached under `$TEMP_DIR/stems-cache` (20 entries / 2 GB, oldest evicted first). The
  `#/stems` screen lists and cancels jobs, plays a cached mix or a single stem, and clears the
  cache.
- **Remote stems service**: `STEMS_SERVICE_URL` and `STEMS_SERVICE_TOKEN` let a desktop or
  private server send the audio to a machine with more CPU or a GPU instead of running the model
  locally.
- **Song layout**: the active chord diagram sits under the player, the audio, details and harmony
  cards are collapsible with a `[+]`/`[-]` marker, and auto-scroll keeps the next two rows of the
  grid visible inside its own scroll container.
- **Navigation**: **Biblioteca**, **Listas** and **Pistas** are available from the header on
  every screen; the stems link only appears when a plugin or service is available.
- **Collaboration revisions**: shared songs keep versioned collaborative edits.
- **Administration**: administrators see the analysis activity feed and can open analyzed songs
  directly from it, including on small screens.
- **Security**: the collaborative endpoints are hardened and the content security policy is
  trimmed to what the app uses.

## Online mode

Online mode remains opt-in and local/desktop use is unchanged. Analysis results are stored in
Firestore without audio. Stem separation is local or go to the service you configure; the hosted
Cloud Run instance does not separate audio and does not ship the plugin.

## Web

The public build at <https://moiseslodeiro.github.io/chordifree/> remains local-only.
Online mode is available when the API and Google OAuth are configured.

## Desktop

The installers are built from the tagged commit. They bundle the local analyzer, ffmpeg and the
ONNX models; the stems plugin is not bundled, see `docs/STEMS_PLUGIN.md`.

### Windows

- Download `chordifree-0.5.0-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.5.0-arm64.dmg`
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-0.5.0-x86_64.AppImage` or `chordifree-0.5.0-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available yet.

# Chordifree 0.4.0

Microphone practice, a persistent analysis cache and a more reliable remote extractor.

## Highlights

- **Microphone practice**: Chordifree can listen to your instrument and marks the current
  chord once it matches the timeline. The microphone toggle lives in the practice row, the
  detected chord is shown next to the target and the audio is processed in the browser, so it
  never leaves the device.
- **Persistent analysis cache**: completed YouTube analyses are stored in Firestore for 90
  days, keyed by video and analyzer version. Reopening a song, or analyzing it on another
  Cloud Run instance, reuses the stored chords instead of downloading the audio again.
- **Analyzed search results**: YouTube search marks the videos that already have a cached
  analysis and the action becomes **Open**. **Reanalyze** sends `force: true` and always
  bypasses the cache.
- **Remote extractor status**: `GET /api/health` reports the residential extractor and its
  version, and the home screen shows **YouTube extractor: Available / Unavailable / Checking**
  only when the API runs in `extractor` mode. Local and direct-YouTube modes are unchanged.
- **Remote playback fix**: the player downloads the YouTube audio with the authenticated
  request and hands `<audio>` a local blob URL, so playback works when the API requires a
  session token. The blob is released when the song closes.
- **Raspberry Pi extractor guide**: a complete headless install with Tailscale Funnel or a
  Cloudflare named tunnel, token rotation, service operations and troubleshooting, plus the
  current `yt-dlp` ARM64 and x86-64 asset names in the installer.
- **Security hardening**: HSTS, a Permissions-Policy that allows the microphone, `no-store`
  on auth and admin responses, per-route rate limits and a CSP that permits Google Identity
  Services. The gRPC and OpenTelemetry advisories were patched.
- **Dependencies**: React 19, Tailwind 4 with CSS-first configuration, the OpenTelemetry SDK
  and instrumentations at 0.301/3.1, and Node 22 in the Docker images.
- **Monitoring**: Cloud Monitoring alerts now use the correct email label.

## Online mode

Online mode remains opt-in and does not change local or desktop use. Analysis results are
stored in Firestore without audio: only chords, beats and metadata are kept. The collection
uses a 90-day TTL, so expired documents are removed automatically. See
`docs/OPERATIONS.md` and `docs/RASPBERRY_PI_EXTRACTOR.md` for the data model and the Pi
installation.

## Web

The public build at <https://moiseslodeiro.github.io/chordifree/> remains local-only.
Online mode is available when the API and Google OAuth are configured.

## Desktop

The installers are built from the tagged commit. They bundle the local analyzer, ffmpeg
and the ONNX models.

### Windows

- Download `chordifree-0.4.0-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.4.0-arm64.dmg`
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-0.4.0-x86_64.AppImage` or `chordifree-0.4.0-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available yet.

# Chordifree 0.3.1

Private online mode, an optional YouTube extractor and a clearer song layout.

## Highlights

- **Private online mode (opt-in)**: Google sign-in, an allowlist and a per-user cloud
  library, with account deletion and a clear local-only fallback. The GitHub Pages build
  stays local-only; online mode requires a configured server and Google OAuth.
- **Cloud sync**: songs and setlists merge per user. A sync failure keeps the local library
  usable and is shown as a warning, never as a blocking modal.
- **Shared contracts**: web and server use the same Zod schemas for songs, setlists,
  authentication and cloud requests.
- **Security and operations**: per-user rate limits, session-expiry handling, privacy,
  terms, security and operations documentation, a Firestore backup script and an optional
  GCS backup backend example.
- **Raspberry Pi YouTube extractor**: an optional fallback for blocked YouTube requests,
  behind Cloudflare Tunnel or Tailscale Funnel and configured with `YOUTUBE_EXTRACTOR_URL`.
- **Monitoring**: Cloud Monitoring alerts for analysis failures and 5xx responses, an
  uptime check and optional OTLP traces.
- **YouTube errors**: bot blocks are now distinguished from missing or private videos.
- **Design refresh**: native confirmation dialogs, a keyboard-navigable action menu,
  better form semantics, mobile order of player → timeline → active chord → details →
  harmony, a contiguous sticky tools rail and a balanced home side panel.
- **Less duplication**: harmonic analysis is the single chord list in the song view.
- **Dependencies**: FastAPI, python-multipart and the GitHub Pages actions were updated.

## Online mode

Online mode is opt-in and does not change local or desktop use. When enabled, the server
verifies Google ID tokens, checks the Firestore allowlist and stores one cloud snapshot per
user. Users can delete their cloud data from the account menu. See `PRIVACY.md`,
`SECURITY.md` and `docs/OPERATIONS.md` for the data model and operational details.

## Web

The public build at <https://moiseslodeiro.github.io/chordifree/> remains local-only.
Online mode is available when the API and Google OAuth are configured.

## Desktop

The installers are built from the tagged commit. They bundle the local analyzer, ffmpeg
and the ONNX models.

### Windows

- Download `chordifree-0.3.1-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.3.1-arm64.dmg`
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-0.3.1-x86_64.AppImage` or `chordifree-0.3.1-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available yet.

# Chordifree 0.3.0

Audio transposition, one player for YouTube and uploads, and a simpler library.

## Highlights

- **Audio pitch**: transpose uploaded audio and temporary YouTube audio by ±12 semitones
  without changing the tempo. The setting is independent from chord transposition.
- **One player bar**: YouTube songs show their thumbnail and play temporary server audio;
  uploaded files hide the native controls. The main transport is the only playback bar.
- **Temporary YouTube audio cache**: kept for one hour on hosted servers and until you clear
  it on localhost/desktop. The library shows its size and has a clear button.
- **Simpler library**: folders are removed and setlists are the only grouping. Older backups
  with folders still import their songs; legacy folder assignments are ignored.
- **Save only when needed**: a saved song shows “Save changes” only after changing
  transpose, notation, accidentals, capo or details. Editor and lyric saves clear the state.
- **Add to setlist** from More actions, either to an existing setlist or a new one.
- **Mobile controls**: accidentals, instrument and capo move into “More settings”; metronome,
  BPM and count-in move into “More practice”.
- **Chord toolbar**: accidentals are Auto, ♯ and ♭ buttons; “Transponer”; simplification and
  reduction are separate chip groups; the key moved to Song Details. Two bars per row and
  the chord grid as the default song view.
- **Time signature**: the analyzer estimates 3/4 or 4/4 and Song Details lets you correct it.
- **Search and reanalysis**: search results use “Analyze”, and reanalysis shows its progress
  in a toast.
- **Max reduction**: a dominant chord that starts just before a bar line keeps its real start.
- Every song opens at the original tempo and pitch; the A–B range and metronome BPM are still
  remembered.

## Breaking changes

- **Folders are gone.** Setlists replace them. Existing libraries keep their songs; old
  folder assignments are ignored and cleaned up when a song is saved. JSON backups that
  contain folders continue to import their songs.
- **Speed and pitch no longer persist across openings.** Each song starts at 1× and 0
  semitones, like the original recording.
- YouTube playback now uses a temporary server copy of the audio instead of the embedded
  player, so the web app needs the API and the desktop app uses its bundled server. The
  existing legal notice about downloading YouTube audio still applies.

## Web

The web app is available at <https://moiseslodeiro.github.io/chordifree/>.

## Desktop

The installers are built from the tagged commit. They bundle the local analyzer, ffmpeg
and the ONNX models. The Windows, Linux and Apple Silicon macOS installers are attached to
this release. The Intel macOS build is not included yet.

### Windows

- Download `chordifree-0.3.0-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.3.0-arm64.dmg`
- Intel: not included in 0.3.0 yet.
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-0.3.0-x86_64.AppImage` or `chordifree-0.3.0-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available yet.

# Chordifree 0.2.0

Local-first chord practice for YouTube videos and audio files. This release brings
library organisation, lyrics lookup, visual chord positioning, score export and a
cleaner printable sheet.

## Highlights

- **Library folders**: group songs into folders, move them between folders and keep
  shared songs unfiled.
- **Lyrics from LRCLIB**: find lyrics by title and artist and review them before
  saving.
- **Chord positioning**: drag the four-direction crosshair over a lyric line, or use
  the arrow keys, and the position is saved with the song.
- **MusicXML score export**: export the chord grid as a score with instrument-aware
  clefs (piano grand staff, guitar octave-down treble, ukulele treble).
- **Printable lyrics and chords**: the print sheet now includes the lyrics with
  chords, chord diagrams for the selected instrument and the app version. The
  useless print action was removed from setlists.
- **Desktop update check**: the packaged app checks GitHub releases and reports
  available updates without blocking the interface.
- **Compact song actions and toasts**: secondary actions live in a menu and
  transient notices no longer move the layout.

## Security and reliability

- Share links and library imports were hardened.
- The local API now rejects cross-origin writes and binds to loopback by default.
- Dependencies were refreshed: Node 22.22+/24.15+, TypeScript 6, current GitHub
  Actions, FastAPI, Uvicorn and pytest. `pnpm audit --prod` reports no known
  vulnerabilities.

## Web

The web app is available at <https://moiseslodeiro.github.io/chordifree/>.

## Desktop

The installers are built manually from the tagged commit. They bundle the local
analyzer, ffmpeg and the ONNX models.

### Windows

- Download `chordifree-<version>-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-<version>-arm64.dmg`
- Intel: `chordifree-<version>-x64.dmg` when the Intel build is available.
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System
  Settings → Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

### Linux

- `chordifree-<version>-x86_64.AppImage` or `chordifree-<version>-amd64.deb`
- Verify `SHA256SUMS.txt` before running it.
- The AppImage may need FUSE (`libfuse2` or `libfuse2t64`); the `.deb` installs with
  `apt`.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/LINUX_INSTALL.md>

Code signing, notarization and automatic installation of updates are not available
yet.
