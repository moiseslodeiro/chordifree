# Launch notes

## GitHub repository

**Description**

> Turn YouTube videos or your own audio into synchronized chord sheets you can practice with. Local-first, Docker-ready, English/Spanish UI.

**Topics**

`music` `chords` `chord-recognition` `essentia` `react` `typescript` `fastapi` `docker`
`self-hosted` `music-practice`

**Pinned files**

- `README.md`
- `LICENSE`
- `deploy/Caddyfile.example`

## X / Twitter draft (English)

> I built Chordifree: paste a YouTube link or upload audio, get a synchronized chord sheet with
> beats, bars, lyrics and A–B practice.
>
> It runs locally with Docker, stores everything in your browser, and the UI switches between
> English and Spanish.
>
> Free and open source (AGPL-3.0). Feedback welcome.
>
> [GitHub link]

## X / Twitter draft (Spanish)

> He creado Chordifree: pega un enlace de YouTube o sube un audio y obtén una hoja de acordes
> sincronizada con pulsos, compases, letra y práctica A–B.
>
> Funciona en local con Docker, guarda todo en tu navegador y la interfaz cambia entre inglés y
> español.
>
> Gratis y open source (AGPL-3.0). Se agradece feedback.
>
> [Enlace a GitHub]

## Before publishing

- [ ] Replace `<your-user>` in the README clone URL.
- [ ] Add a short demo GIF or screenshot to the README.
- [ ] Confirm the repository license is AGPL-3.0 and the model-license note is visible.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm -r test`, analyzer tests and E2E.
- [ ] Test `docker compose up --build -d` on a clean machine.
- [ ] Decide whether to keep the YouTube link option enabled or default to audio upload.
- [ ] Add the repository topics and description above.
- [ ] Pin the repository on your GitHub profile.
