# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-taught guitarists, pianists and ukulele players who practise at home with songs they
like. They do not have a teacher, a score or a band arrangement; they need to know which
chords to play, when each one starts and how to loop the difficult part. They may use the
browser app on a laptop or the desktop build on the same machine, and they switch between
English and Spanish.

## Product Purpose

Chordifree turns a YouTube video or an audio file into a synchronized chord sheet: key,
beat grid, bars, chords, lyrics and the sung regions, all aligned with playback. The user
then corrects anything the analyzer got wrong, saves the song to a local library and
practises with an A–B range. Success means the user can play along with the song without
guessing, and the sheet keeps matching after transposition, a capo or a simpler voicing.

## Positioning

The analysis runs on the user's machine, not on a subscription service: no account, no
tracking, no upload to a third party. The output is treated as a draft the musician owns,
so every chord can be corrected and every lyric line anchored. The desktop build bundles
the analyzer. The product is open source (AGPL-3.0), and it is built by a musician for
musicians.

## Operating Context

- Source: a YouTube link, a YouTube search result, or a local audio file (MP3, WAV, M4A,
  OGG, FLAC, WebM, MP4; up to 25 MB and 15 minutes).
- Practice: play, pause, seek, slow down, repeat a bar, count in, and mark an A–B range to
  loop; the active beat and chord follow playback.
- Presentation: transpose ±11 semitones, capo, English or Spanish notation, sharps or flats,
  guitar/piano/ukelele diagrams, simplify or reduce chords.
- Library: songs, folders and setlists in local storage, with practice history, JSON
  backups, ChordPro import/export, MusicXML export, print/PDF, and share links for a song
  or a setlist.
- Deployment: Docker stack for a laptop, home server or VPS; PWA when served over HTTPS;
  Electron desktop builds for Windows, macOS and Linux.

## Capabilities and Constraints

- Chord detection with Essentia `NNLSChroma`, key estimation and Viterbi smoothing; beat
  grid and bar view; vocal-region detection with YAMNet/voice ONNX models.
- Lyrics lookup by title and artist (LRCLIB), manual lyrics, approximate timing and manual
  anchors; per-line chord positioning.
- YouTube search (`yt-dlp`) with thumbnail, channel and duration, one click to analyze.
- Time signature estimated from the beat accents (3/4 or 4/4) and correctable in the song
  details (2/4, 3/4, 4/4).
- Local-first storage; shared songs stay unfiled; the analysis cache can be inspected and
  cleared.
- Constraints: the analyzer needs Essentia and ONNX Runtime; the voice/instrumental model
  is CC BY-NC-SA 4.0 (non-commercial); YouTube downloads may violate its Terms of Service;
  the analyzer exposes AGPL obligations when served over a network; ARM64 Linux is not
  supported because Essentia publishes no arm64 Linux wheel; desktop builds are unsigned
  and not notarized; `yt-dlp` is not bundled in the desktop app.
- Accessibility target: WCAG 2.1 AA, with keyboard navigation, visible focus and
  screen-reader labels; end-to-end tests run axe on the home and song screens.

## Brand Commitments

- Name: Chordifree. Logo: the note mark with "chordi" in ink and "free" in electric blue.
- Voice: plain, specific and unhyped. Controls name their action; errors name the problem
  and the recovery. English and Spanish are first-class.
- Signature line: "From a musician, for musicians. Built by Moisés Lodeiro."
- The product is not a subscription business and does not pretend to be one.

## Evidence on Hand

- A built-in demo song (`Chordifree demo · C G Am F`) that exercises grid, bars, lyrics and
  A–B practice without an account or network.
- Screenshots of the bar view, beat grid and YouTube search in `site/assets/`.
- Real installers and release notes in `docs/`; Docker Compose stack; smoke-test fixture.
- There are no testimonials, customer logos, benchmarks, prices or usage statistics. Do not
  invent any.

## Product Principles

1. **Local by default.** Audio, analysis and library stay on the user's device; the network
   is for the source and for lyrics lookup, never for an account.
2. **The musician is the authority.** Detection is a draft; every chord, timing and lyric
   anchor must be correctable, and corrections must survive reopening the song.
3. **Practice is the outcome.** Every view serves playing along: the next chord, the current
   beat and the range to loop must be obvious at a glance.
4. **Be honest about limits.** Show confidence, legal notices and non-commercial model
   licences instead of hiding them behind a polished promise.
5. **Two languages, one product.** English and Spanish are designed together, not translated
   at the end.

## Accessibility & Inclusion

WCAG 2.1 AA is the target: keyboard access to every control, visible focus rings, contrast
of at least 4.5:1 for body text, labelled form controls and regions, and reduced-motion
support. The interface must work at 390 px wide and with screen readers.
