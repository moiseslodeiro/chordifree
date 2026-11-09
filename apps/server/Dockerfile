# syntax=docker/dockerfile:1

# Versiones fijadas: Node, pnpm, ffmpeg/ffprobe y yt-dlp.
ARG NODE_VERSION=20-bookworm-slim
ARG PNPM_VERSION=9.15.9
ARG FFMPEG_IMAGE=mwader/static-ffmpeg:7.1
ARG YTDLP_VERSION=2026.10.26

FROM ${FFMPEG_IMAGE} AS ffmpeg

FROM node:${NODE_VERSION} AS build
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# Instala las dependencias con el lockfile antes de copiar el código para
# aprovechar la caché de capas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/chords/package.json packages/chords/package.json
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter @chordifree/web build

FROM node:${NODE_VERSION} AS runtime
ARG PNPM_VERSION
ARG YTDLP_VERSION

# ffmpeg y ffprobe se copian de una imagen fijada por etiqueta, así el build no
# depende de la versión que traiga la distribución base.
COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL -o /usr/local/bin/yt-dlp \
        "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" \
    && echo '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795  /usr/local/bin/yt-dlp' | sha256sum -c - \
    && chmod +x /usr/local/bin/yt-dlp \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app
COPY --from=build /app /app

ENV NODE_ENV=production
ENV TEMP_DIR=/tmp/chordifree
RUN mkdir -p /tmp/chordifree && chown -R node:node /app /tmp/chordifree
USER node

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD curl -fsS http://127.0.0.1:3001/api/health || exit 1

CMD ["pnpm", "--filter", "@chordifree/server", "start"]
