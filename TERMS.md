# Terms of use

Last updated: 2026-11-16

Chordifree is free, open-source software provided under the **AGPL-3.0** licence. These terms
describe the software and the optional private online deployment. They are not legal advice.

## Use at your own risk

The software is provided **as is**, without warranty of any kind. The authors are not liable
for any loss, damage, service interruption or legal consequence resulting from its use.

## Your content and permissions

You are responsible for the audio, links, lyrics and other content you submit. Only analyze
content you own or are allowed to use. Downloading YouTube audio may violate YouTube's Terms
of Service; use the audio-upload option when you do not have the rights.

## Local and desktop mode

Local and desktop use does not require an account. The library and settings stay on your
device. You are responsible for backups and for keeping your own copy of the data.

## Private online mode

An online instance is operated by the person or organization that deploys it, not by the
Chordifree authors.

- Access is limited to the Google accounts the operator approves. Do not share an approved
  account or try to bypass the allowlist.
- The operator may add or remove accounts, suspend the instance or delete its data.
- The library is stored in the operator's Firestore project. The operator and the Google Cloud
  project owners can access that data.
- The operator may configure an optional residential YouTube extractor. YouTube traffic then
  passes through that extractor and its token.
- There is no SLA. The instance may be scaled to zero, stopped or deleted at any time.
- Use the account menu to delete your cloud data. Removing your access does not delete the
  local copy on your devices.

The operator is responsible for complying with applicable privacy, data-protection and
consumer law in its jurisdiction, including providing its own privacy notice where required.

## Model and third-party licences

- Essentia is AGPL-3.0.
- YAMNet is Apache-2.0.
- The Essentia voice/instrumental classifier is CC BY-NC-SA 4.0 (non-commercial). Do not use
  it in a paid product without a commercial licence or a replacement model.
- `yt-dlp`, ffmpeg, Google Identity, Google Cloud and other dependencies keep their own
  licences and terms.

## No warranty for analysis results

Chord, key, beat and lyric detection are automatic and may be wrong. Always review the result
before relying on it for a performance, recording or publication.

## Privacy

See [PRIVACY.md](PRIVACY.md). Local mode is local-first and has no accounts. The optional
online mode uses Google sign-in, an allowlist and Firestore, as described there.

## Changes

These terms may change with the project. The version in the repository at the time of use is
the applicable one.
