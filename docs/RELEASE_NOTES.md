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

The installers are built manually from the tagged commit. They bundle the local analyzer,
ffmpeg and the ONNX models. Version 0.3.0 is published as a pre-release while the installers
are prepared; use the Desktop builds workflow on `v0.3.0` to generate them:

```bash
git tag v0.3.0
git push origin v0.3.0
gh workflow run desktop-builds.yml --ref v0.3.0
```

### Windows

- Download `chordifree-0.3.0-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-0.3.0-arm64.dmg`
- Intel: `chordifree-0.3.0-x64.dmg` when the Intel build is available.
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
