## Chordifree desktop preview

This release contains unsigned preview builds for Windows and macOS.

### Windows

- Download `chordifree-<version>-setup.exe`.
- Verify `SHA256SUMS.txt` before running it.
- SmartScreen: **More info → Run anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/WINDOWS_INSTALL.md>

### macOS

- Apple Silicon: `chordifree-<version>-arm64.dmg`
- Intel: `chordifree-<version>-x64.dmg`
- Verify `SHA256SUMS.txt` before opening it.
- The app is ad-hoc signed, not notarized. If Gatekeeper blocks it, open **System Settings →
  Privacy & Security → Open Anyway**.
- Guide: <https://github.com/moiseslodeiro/chordifree/blob/main/docs/MACOS_INSTALL.md>

The installers are built by GitHub Actions from the tagged commit. They bundle the local
analyzer, ffmpeg and the ONNX models. Code signing and notarization are not available yet.
