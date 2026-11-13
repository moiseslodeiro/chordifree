# Install Chordifree on Linux

Chordifree for Linux is a preview build for **x86_64**. It is distributed as an
AppImage and a Debian package.

Every release includes a `SHA256SUMS.txt` file so you can verify the download.

## Requirements

- 64-bit Linux (x86_64).
- glibc 2.35 or later (the build uses Ubuntu 22.04 as its baseline).
- A few hundred MB of free disk space.
- No Docker, Python, Node.js or ffmpeg installation is needed. The app bundles the analyzer,
  ffmpeg and the ONNX models.

ARM64 Linux is not supported yet because Essentia does not publish an arm64 Linux wheel.

## Download

1. Open the latest release:
   <https://github.com/moiseslodeiro/chordifree/releases/latest>
2. Download one of:
   - `chordifree-<version>-x86_64.AppImage`
   - `chordifree-<version>-amd64.deb`
3. Download `SHA256SUMS.txt`.

## Verify the download

```bash
sha256sum chordifree-0.2.0-x86_64.AppImage
grep chordifree-0.2.0-x86_64.AppImage SHA256SUMS.txt
```

The hashes must match. If they do not, delete the file, download it again and do not run it.

The checksum confirms that the file matches the published build. It does not prove that the
build is trustworthy by itself.

## AppImage

```bash
chmod +x chordifree-0.2.0-x86_64.AppImage
./chordifree-0.2.0-x86_64.AppImage
```

If the AppImage fails because FUSE is not available, install it and try again:

```bash
# Ubuntu 22.04
sudo apt install libfuse2
# Ubuntu 24.04
sudo apt install libfuse2t64
```

Alternatively, extract and run it without FUSE:

```bash
./chordifree-0.2.0-x86_64.AppImage --appimage-extract-and-run
```

## Debian package

```bash
sudo apt install ./chordifree-0.2.0-amd64.deb
```

Then launch **Chordifree** from your application menu, or run:

```bash
chordifree
```

## First run

- The app starts its local analyzer. The first launch can take a few seconds.
- Audio is analyzed on your computer. There is no account and no cloud service.
- The library lives in `~/.config/Chordifree`. Use **Export JSON** in the library for backups.
- YouTube analysis needs `yt-dlp` installed separately; audio upload works out of the box.
  YouTube downloads may violate its Terms of Service.

## Uninstall

For the Debian package:

```bash
sudo apt remove chordifree
```

For the AppImage, delete the file. Optionally delete `~/.config/Chordifree` to remove the
local library.

## Why is it not signed?

The AppImage and `.deb` are not signed with a distribution key. Verify the SHA-256 checksum
before running them. The analyzer and ffmpeg binaries are bundled inside the application.
