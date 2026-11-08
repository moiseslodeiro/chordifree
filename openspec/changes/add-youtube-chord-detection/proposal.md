# Proposal

## Why

Aprender una canción de oído requiere identificar los acordes y saber cuándo suenan, pero las tablaturas estáticas no se sincronizan con el video y obligan a buscar la tonalidad y la notación adecuadas. Esta aplicación convierte un video musical de YouTube (o un audio propio) en una línea de tiempo de acordes sincronizada con la reproducción, permitiendo trasponer y cambiar entre notación inglesa y española en tiempo real.

## What Changes

- Nueva aplicación web full-stack: SPA en React + TypeScript servida por un backend Node + Express.
- Ingesta de audio desde un enlace de YouTube (extracción con `yt-dlp` + `ffmpeg`) y desde un archivo de audio subido por el usuario.
- Microservicio Python de análisis armónico con Essentia que detecta segmentos de acordes (inicio, fin, etiqueta) y los devuelve normalizados.
- Reproductor embebido de YouTube sincronizado con una rejilla de acordes que resalta el acorde activo y permite saltar a cualquier marca de tiempo.
- Trasposición cromática (± semitonos) con ortografía enarmónica correcta y visualización en notación inglesa (C, Dm, F#) o española/latina (Do, Rem, Fa#).
- Editor de corrección para ajustar acordes, dividir/fusionar segmentos y mover marcas de tiempo.
- Biblioteca local de canciones en `localStorage`, con caché de análisis para evitar reanálisis.
- Límites operativos: duración máxima, tamaño de archivo, rate limiting, cola de trabajos y limpieza de temporales.

## Capabilities

### New Capabilities

- `chord-analysis`: ingesta de audio (YouTube y subida de archivo), extracción, detección automática de acordes y contrato de la línea de tiempo resultante.
- `chord-playback`: reproducción del video y sincronización de la rejilla de acordes con el tiempo actual, incluyendo resaltado y navegación por marcas.
- `chord-notation`: representación canónica de acordes, trasposición cromática y conversión entre notación inglesa y española.
- `chord-editing`: corrección manual de los acordes detectados y de sus tiempos antes de guardar.
- `song-library`: persistencia local de canciones, cifrados editados y caché de análisis en el navegador.

### Modified Capabilities

<!-- Ninguna: el proyecto no tiene specs existentes. -->

## Impact

- **Código nuevo**: estructura de monorepo (`apps/web`, `apps/server`, `services/analyzer`), sin código previo que modificar.
- **APIs**: `POST /api/analyses` (URL de YouTube o multipart de audio), `GET /api/analyses/:id`, `GET /api/health`.
- **Dependencias de sistema**: `yt-dlp`, `ffmpeg`, Python 3.11+ con Essentia; Node 20+.
- **Dependencias de aplicación**: Express, React, Vite, TypeScript, Tailwind CSS, Zod, YouTube IFrame API, Vitest, Playwright.
- **Datos**: sin base de datos; todo el estado del usuario vive en `localStorage`. El backend es stateless salvo ficheros temporales y caché de resultados con TTL.
- **Riesgos**: la descarga de audio de YouTube puede contravenir sus Términos de Servicio y Essentia se distribuye bajo AGPL-3.0; ambos condicionan el despliegue y la licencia del proyecto (ver `design.md`).
