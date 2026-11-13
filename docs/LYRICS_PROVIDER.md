# Lyrics provider

## Goal

Let the user fetch lyrics for a song from a public lyrics API and insert them into
the lyrics editor as a draft. The user reviews and saves the result manually.

## Provider

Use [LRCLIB](https://lrclib.net) as the first provider. It is free, does not require
an API key and returns plain and synchronized lyrics. Do not scrape sites whose
terms forbid automated access (Genius, AZLyrics, etc.).

## Flow

1. In the lyrics editor, the user presses **Find lyrics**.
2. The client sends the song title, artist and duration to
   `GET /api/lyrics?artist=...&title=...&duration=...`.
3. The server queries LRCLIB with a timeout and a response-size limit, then returns
   `{ plainLyrics, syncedLyrics, source }`.
4. The client fills the textarea as an unsaved draft.
5. The user edits and saves; nothing is written to the library before that.

## Security and privacy

- Only title/artist/duration are sent, and only after an explicit click.
- The request goes through the local API, so no third-party key or endpoint is
  exposed to the browser and the CSP can stay `connect-src 'self'`.
- Validate and cap query lengths; reject empty titles.
- Cap the response body, use an abort timeout and rate-limit the endpoint.
- Do not persist provider responses beyond the song the user chooses to save.
- Respect LRCLIB's terms and attribution requirements.

## Tests

- Server route with mocked fetch: match, no match, timeout, oversized body and
  invalid parameters.
- UI: button disabled while loading; error notice; draft is not saved until the
  user presses Save.
- English and Spanish strings.

## Out of scope

- Scraping lyrics sites.
- Automatic background fetching.
- Sending audio or user library data to the provider.
