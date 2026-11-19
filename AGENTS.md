# AGENTS.md

Chordifree turns a YouTube video or an audio file into a synced chord timeline. Local-first;
the optional online mode uses Google sign-in + Firestore.

## Layout

- `apps/web` — React 19 + Vite 5 + Tailwind 4 SPA. No router library: hash routing in `src/routing.ts`. Library in `localStorage`.
- `apps/server` — Express 4 API (TypeScript, run with `tsx`; no build step). Analyser jobs run in-process.
- `packages/contracts` — shared types + Zod schemas; **start API/model changes here**.
- `packages/chords` — pure chord/segment utilities shared by web and server.
- `packaging/electron` — Electron shell + installer build.
- `services/analyzer` — FastAPI + Essentia/ONNX sidecar (Python, not a pnpm package).
- `services/youtube-extractor` — Flask + yt-dlp service for the Raspberry Pi.

## Commands

```bash
pnpm install
pnpm dev                  # web :5173 + API :3001 (does NOT start the analyzer)
pnpm typecheck            # all packages
pnpm lint                 # eslint .
pnpm test                 # every workspace test suite
pnpm --filter @chordifree/web test -- tests/home.test.tsx   # single web file
pnpm --filter @chordifree/server test -- tests/collab.test.ts
pnpm build                # web production build only
pnpm test:e2e             # Playwright; config starts Vite on :4173
pnpm --filter @chordifree/web exec playwright test --project=chromium -g "name"
python -m pytest services/analyzer/tests -q
(cd services/youtube-extractor && python -m pytest -q)
```

- The analyzer must be running on `:8001` for analysis: `uvicorn app.main:app --app-dir services/analyzer --port 8001`, or the Docker image. On this machine `docker compose` is unavailable but `docker-compose` (v1) works; full stack on `:3000`.
- `.env` is optional; defaults are local mode (`AUTH_MODE=none`, analyzer `http://localhost:8001`).
- CI runs web, server, analyzer, extractor, Chromium E2E and `docker compose build`; all must pass.
- Tests default to Spanish (`apps/web/tests/setup.ts` calls `setLanguage('es')`). Call `setLanguage('en')` before asserting English text.

## Conventions that bite

- Adding a `Song` field: declare it in `packages/contracts/src/types.ts` **and** validate it in `isSong` (`apps/web/src/storage/library.ts`). `CloudSongSchema` is `.passthrough()`, so the server needs changes only for identity fields.
- All UI strings live in `apps/web/src/i18n/messages.ts`. `es` is typed as `Record<MessageKey, string>`, so a missing translation fails typecheck.
- E2E tests never touch a real API: they intercept routes (`e2e/support.ts`, `stubApi`). `fakePlayer=1` swaps in `FakePlayerAdapter`; real `<audio>` playback paths are in `e2e/pitch.spec.ts`.
- Playback adapters implement `packages`-agnostic `PlayerAdapter` (`apps/web/src/player/types.ts`); pitch and karaoke use a Web Audio graph with SoundTouch, so latency is compensated in `getCurrentTime()`.
- `SongView.tsx` is the hub for the song view (grid, lyrics, practice, sections, collab panel). Large changes there usually need matching tests in `apps/web/tests/`.

## Server specifics

- Auth order in `apps/server/src/app.ts` matters: `/api/config`, `/api/auth`, `/api/admin*` are public or self-guarded; everything else sits behind `requireAllowed`. Mount new authenticated routers after that line, and admin routers with `authenticateUser` + `requireAdmin`.
- Firestore is used **only** when `AUTH_MODE=google`; local mode uses in-memory stores. In server tests with `authMode: 'google'`, pass the memory stores (`cloudLibrary`, `profiles`, `collab`, `analysisLog`, `analysisCache`) or the suite hangs on Firestore without credentials.
- Validate route params before using them as Firestore document IDs (share IDs are 32-hex, revisions are UUIDs); otherwise malformed URLs become 500s.
- Rate-limit per `uid` on new write/read endpoints; the existing limiters are a good template.
- Security headers exist twice: Helmet in `apps/server/src/app.ts` and `apps/web/security-headers.conf`. Change both when adding an origin.
- Don't re-add the YouTube iframe player: it was removed and the CSP no longer frames YouTube.

## Desktop and releases

- The server is bundled to ESM by `packaging/electron/build.mjs`; its banner injects `require`, `__dirname` and `__filename` because google-gax/Firestore read them. Removing it breaks the packaged app.
- Release flow: bump the version in all six `package.json` files, update `docs/RELEASE_NOTES.md`, tag `vX.Y.Z`, then `gh workflow run desktop-builds.yml --ref vX.Y.Z` (the workflow publishes the release and assets).
- Cloud Run deploy: `deploy/gcp/deploy.sh` builds both images and applies Terraform. `terraform.tfvars`, state and `backend.tf` are gitignored secrets — never commit them.
- **Never push, open PRs or deploy without explicit user permission.** Work locally, run the checks, and ask first.

## Hard-earned gotchas

- `apps/server` has no build output; Docker builds it separately (`apps/server/Dockerfile`).
- `packages/electron` bundles must be rebuilt (`pnpm --filter @chordifree/desktop-spike build:server`) before packaging; generated dirs are ignored.
- CI checks the Docker build with `docker compose build`; a broken Dockerfile is a red check even when tests pass.
- Firestore TTLs (`chordifree_analysis`, `chordifree_analysis_log`) are Terraform resources; adding a new expiring collection means adding its `google_firestore_field`.
