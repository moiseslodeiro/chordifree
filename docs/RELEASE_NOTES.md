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
