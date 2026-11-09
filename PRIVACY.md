# Privacy

Chordifree is designed as a local-first tool. The default deployment does not include
accounts, analytics, advertising or third-party tracking.

## What stays in the browser

- The song library, saved analyses, practice settings, theme and language preference are
  stored in `localStorage` on the device.
- Nothing is uploaded to a Chordifree server unless you start an analysis.
- You can remove everything from the app, delete site data in the browser, or use the
  export/import JSON tools.

## What the server receives

When you start an analysis, the server receives the YouTube URL or the audio file you
selected. It downloads or converts the audio into a temporary directory, sends it to the
analyzer, and removes the temporary files when the job finishes. A cleanup job also removes
stale temporary directories.

The in-memory job store keeps job metadata and the analysis result for up to 24 hours, or
until the process restarts. It is not a permanent database and is not shared between
different server instances.

## Third parties

- **YouTube**: if you use the YouTube option, YouTube and `yt-dlp` are involved. Their terms
  and privacy policies apply.
- **Google Fonts**: the web app loads Manrope and IBM Plex Mono from Google Fonts. Self-host
  the fonts if you need a deployment with no third-party requests.
- **Essentia, YAMNet and the voice/instrumental model**: see the license notes in the README.

## Logs

The server and analyzer write operational logs (HTTP status, analysis errors, container
health). They do not intentionally log audio content, lyrics or credentials. Configure log
retention and access according to your deployment.

## Changes

This document describes the default open-source deployment. If you add accounts, payments,
analytics or cloud storage, update this policy and add the required consent and retention
controls.
