# Install Chordifree on Windows

Chordifree for Windows is a preview build. It is **not code signed yet**, so Windows
SmartScreen will warn you the first time you run the installer. That is expected, not a
sign that the file is broken.

Every release includes a `SHA256SUMS.txt` file so you can check that the installer you
downloaded is the one built by CI.

## Requirements

- Windows 10 or Windows 11, 64-bit.
- A few hundred MB of free disk space.
- No Docker, Python, Node.js or ffmpeg installation is needed. The installer bundles the
  analyzer, ffmpeg and the ONNX models.

## Download

1. Open the latest release:
   <https://github.com/moiseslodeiro/chordifree/releases/latest>
2. Download `chordifree-<version>-setup.exe` and `SHA256SUMS.txt`.

## Verify the download

This step is optional but recommended while the build is unsigned.

PowerShell:

```powershell
Get-FileHash .\chordifree-0.2.0-setup.exe -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

Command Prompt:

```cmd
certutil -hashfile chordifree-0.2.0-setup.exe SHA256
```

The hash must match the line in `SHA256SUMS.txt`. If it does not match, delete the file,
download it again and do not run it.

The checksum proves that the file matches the published build. It does not prove that the
build is trustworthy by itself. If you need that, read the source or build it yourself from
the repository.

## SmartScreen

1. Double-click the installer.
2. If **Windows protected your PC** appears, click **More info**.
3. The publisher will read **Unknown publisher** because the build is unsigned. Check the
   app name and, if you want, the SHA-256 hash.
4. Click **Run anyway**.
5. Finish the installer and launch Chordifree.

If Microsoft Defender flags the file, verify the SHA-256 first. New unsigned builds can
produce false positives. Restore the file from quarantine only after the hash matches, then
allow it. You can also upload the installer to VirusTotal and compare the result.

## First run

- The app starts its local analyzer. The first launch can take a few seconds.
- Audio is analyzed on your computer. There is no account and no cloud service.
- The library lives in `%APPDATA%\Chordifree`. Use **Export JSON** in the library for
  backups.
- YouTube downloads may violate YouTube's Terms of Service. Use audio upload when you do
  not own the content.

## Uninstall

Open **Settings → Apps → Installed apps → Chordifree → Uninstall**.

The uninstaller removes the application. Your library stays in `%APPDATA%\Chordifree` so a
reinstall keeps your songs. Delete that folder manually if you want to remove it too.

## Why is it unsigned?

A publicly trusted code signing certificate requires a certificate authority and, since
2023, a hardware security module. The free route for open source projects is SignPath
Foundation, but it requires a public repository, a release history and an OSI license for
every bundled component. Chordifree is not accepted there yet. Until then, the project
publishes checksums and documents the SmartScreen flow instead of hiding it.
