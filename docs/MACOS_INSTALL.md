# Install Chordifree on macOS

The v0.1.0 preview currently ships the Apple Silicon build only; the Intel build will be
added when available.

Chordifree for macOS is a preview build. It is **ad-hoc signed and not notarized**, so macOS
Gatekeeper will ask you to allow it the first time you open it.

Every release includes a `SHA256SUMS.txt` file so you can verify the DMG before installing.

## Requirements

- **Intel Mac:** macOS 13 or later.
- **Apple Silicon:** macOS 15 or later.
- A few hundred MB of free disk space.
- No Docker, Python, Node.js or ffmpeg installation is needed. The app bundles the analyzer,
  ffmpeg and the ONNX models.

Check your architecture:

```bash
uname -m
```

`arm64` is Apple Silicon. `x86_64` is Intel.

## Download

1. Open the latest release:
   <https://github.com/moiseslodeiro/chordifree/releases/latest>
2. Download the matching file:
   - Apple Silicon: `chordifree-<version>-arm64.dmg`
   - Intel: `chordifree-<version>-x64.dmg`
3. Download `SHA256SUMS.txt`.

The `.zip` files contain the same app if you prefer not to use a DMG.

## Verify the download

```bash
shasum -a 256 chordifree-0.1.0-arm64.dmg
cat SHA256SUMS.txt
```

The hash must match the line in `SHA256SUMS.txt`. If it does not match, delete the file,
download it again and do not install it.

The checksum confirms that the file matches the published build. It does not prove that the
build is trustworthy by itself.

## Install

1. Open the DMG.
2. Drag **Chordifree** to the **Applications** folder.
3. Eject the DMG.

## Gatekeeper

The build is ad-hoc signed, not notarized by Apple. On first launch macOS may say that it
cannot verify the app.

1. Open **System Settings → Privacy & Security**.
2. Scroll to the security message about Chordifree.
3. Click **Open Anyway** and confirm with your password.

On some macOS versions you can also right-click the app in Applications and choose **Open**.

If macOS says the app is damaged because of quarantine, verify the SHA-256 first and then
remove the quarantine attribute:

```bash
xattr -dr com.apple.quarantine /Applications/Chordifree.app
```

Only do that after the checksum matches.

## First run

- The app starts its local analyzer. The first launch can take a few seconds.
- Audio is analyzed on your computer. There is no account and no cloud service.
- The library lives in `~/Library/Application Support/Chordifree`. Use **Export JSON** in the
  library for backups.
- YouTube analysis needs `yt-dlp` installed separately; audio upload works out of the box.
  YouTube downloads may violate its Terms of Service.

## Uninstall

1. Quit Chordifree.
2. Drag **Chordifree** from Applications to the Trash.
3. Optionally delete `~/Library/Application Support/Chordifree` to remove the local library.

## Why is it not notarized?

Notarization requires an Apple Developer Program membership and a Developer ID certificate.
Until that is set up, releases are ad-hoc signed and the Gatekeeper flow above is required.
The same checksum verification applies.
