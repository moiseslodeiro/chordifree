# YouTube extractor for Chordifree

A tiny HTTP service that runs `yt-dlp` on a machine with a residential IP (for example a
Raspberry Pi at home). Chordifree on Cloud Run calls it only for YouTube: probing, searching
and downloading the audio. The analyzer stays in Cloud Run, so the Pi does not need Essentia,
ONNX or a lot of RAM.

For a complete headless Raspberry Pi installation and tunnel walkthrough, see
[`docs/RASPBERRY_PI_EXTRACTOR.md`](../../docs/RASPBERRY_PI_EXTRACTOR.md).

```text
Browser -> Cloud Run (web + API + analyzer)
                  |
                  +-> this service (Cloudflare Tunnel / Tailscale Funnel)
                            |
                            +-> yt-dlp -> YouTube
```

## Why

YouTube blocks many datacenter and Cloud Run IPs with a “confirm you're not a bot” challenge.
A home connection has a residential IP, which is what YouTube expects. The extractor only
downloads the audio; the heavy analysis remains on Cloud Run.

## Requirements

- Raspberry Pi 2 (ARMv7, 1 GB) or newer.
- Raspberry Pi OS (32-bit is fine) with Python 3.9+.
- `yt-dlp` armv7l standalone binary (or a Python install on newer OSes).
- A tunnel that exposes HTTPS: Cloudflare Tunnel or Tailscale Funnel.
- No ffmpeg needed: the service downloads a single audio stream and Cloud Run converts it.

## Quick install (systemd)

From this directory, on Raspberry Pi OS/Debian:

```bash
sudo ./install.sh
```

The script is idempotent. It installs the system packages, creates the `chordifree` user,
sets up the virtualenv, downloads the correct `yt-dlp` binary for the CPU, generates a token,
installs the systemd unit and starts it. It keeps an existing token if
`/etc/chordifree-extractor.env` already exists.

Useful commands:

```bash
sudo systemctl status chordifree-extractor
sudo journalctl -u chordifree-extractor -f
curl http://127.0.0.1:8010/health
```

The systemd unit has `Restart=on-failure`, so the service comes back if it crashes. If you
change `app.py`, run `sudo ./install.sh` again (or copy it and restart the unit).

## Docker (alternative)

Docker Compose gives you the same service with `restart: unless-stopped`. It is convenient on
a Pi 4/5 or an x86 machine; on a Pi 2 the native systemd install is lighter.

```bash
cp .env.example .env
# edit .env and set EXTRACTOR_TOKEN (openssl rand -hex 32)
docker compose up -d --build
docker compose logs -f
```

Or, with the standalone binary:

```bash
docker-compose up -d --build
```

The compose file publishes the service only on `127.0.0.1:8010`, runs it read-only with a
temporary `/tmp`, drops capabilities and adds a healthcheck. `docker compose ps` should show
`healthy`.

If you use cookies in Docker, mount the file and set `YTDLP_COOKIES_FILE` to the path inside
the container.

## Manual install (systemd)

```bash
sudo apt-get update
sudo apt-get install -y python3-venv unzip
sudo useradd --system --create-home --home-dir /opt/chordifree-extractor chordifree
sudo mkdir -p /opt/chordifree-extractor
sudo cp app.py requirements.txt /opt/chordifree-extractor/
sudo chown -R chordifree:chordifree /opt/chordifree-extractor
sudo -u chordifree python3 -m venv /opt/chordifree-extractor/.venv
sudo -u chordifree /opt/chordifree-extractor/.venv/bin/pip install \
  -r /opt/chordifree-extractor/requirements.txt
```

Install `yt-dlp` for 32-bit ARM:

```bash
curl -L -o /tmp/yt-dlp.zip \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_armv7l.zip
sudo unzip -o /tmp/yt-dlp.zip -d /usr/local/bin
sudo chmod +x /usr/local/bin/yt-dlp
yt-dlp --version
```

Create the environment file:

```bash
sudo cp systemd/chordifree-extractor.env.example /etc/chordifree-extractor.env
sudo chmod 600 /etc/chordifree-extractor.env
# edit EXTRACTOR_TOKEN with: openssl rand -hex 32
```

Install and start the service:

```bash
sudo cp systemd/chordifree-extractor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chordifree-extractor
sudo systemctl status chordifree-extractor
```

Test locally:

```bash
TOKEN=$(sudo sed -n 's/^EXTRACTOR_TOKEN=//p' /etc/chordifree-extractor.env)
curl -sS http://127.0.0.1:8010/health
curl -sS -X POST http://127.0.0.1:8010/probe \
  -H "Content-Type: application/json" \
  -H "X-Chordifree-Token: $TOKEN" \
  -d '{"videoId":"dQw4w9WgXcQ"}'
```

## Expose it with a tunnel

### Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create chordifree-extractor
cloudflared tunnel route dns chordifree-extractor extractor.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: chordifree-extractor
credentials-file: /home/chordifree/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: extractor.example.com
    service: http://127.0.0.1:8010
  - service: http_status:404
```

Install `cloudflared` as a service and start it. The public URL is
`https://extractor.example.com`.

### Tailscale Funnel

```bash
sudo tailscale up
sudo tailscale funnel 8010
```

Tailscale prints the public `https://<machine>.<tailnet>.ts.net` URL. Use that as the
extractor URL.

The service is protected by `EXTRACTOR_TOKEN`; do not expose it without the token.

## Chordifree configuration

Set these on the Cloud Run server (Terraform variables in `deploy/gcp`):

```text
YOUTUBE_EXTRACTOR_URL=https://extractor.example.com
YOUTUBE_EXTRACTOR_TOKEN=<same token as the Pi>
```

Terraform:

```hcl
youtube_extractor_url   = "https://extractor.example.com"
youtube_extractor_token = "..." # sensitive
```

When `YOUTUBE_EXTRACTOR_URL` is set, the server uses the extractor for YouTube probe, search
and download. If it is not set, it uses the local `yt-dlp` as before.

## Endpoints

| Method | Path         | Auth                 | Description                            |
| ------ | ------------ | -------------------- | -------------------------------------- |
| GET    | `/health`    | No                   | `{ status, extractorVersion }`         |
| POST   | `/probe`     | `X-Chordifree-Token` | `{ videoId }` → `{ duration, title? }` |
| GET    | `/search?q=` | `X-Chordifree-Token` | `{ results: [...] }`                   |
| POST   | `/download`  | `X-Chordifree-Token` | `{ videoId }` → audio file             |

Errors use `{ "error": { "code": "...", "message": "..." } }`.

- `EXTRACTOR_BUSY` (429): another download/probe is running. The Pi handles one at a time.
- `YOUTUBE_BLOCKED` (422): YouTube still challenged the home IP.
- `EXTRACTOR_UNAVAILABLE` (502): `yt-dlp` missing or the service is offline.
- `EXTRACTOR_TIMEOUT` (504): `yt-dlp` exceeded `EXTRACTOR_TIMEOUT_SECONDS`.

## Update

Native install:

```bash
git pull
sudo ./install.sh
```

Docker:

```bash
git pull
docker compose up -d --build
```

The native script updates the virtualenv, `yt-dlp` and the systemd unit, and keeps the token.
The Docker build replaces the image and restarts the container.

## Security

- The service listens on `127.0.0.1:8010`; do **not** open that port on the router.
- Expose it only through Cloudflare Tunnel or Tailscale Funnel.
- Keep `EXTRACTOR_TOKEN` secret and rotate it if it leaks.
- Do not run the service as root; the systemd unit uses an unprivileged user.
- The service validates `videoId` and uses argument arrays (no shell interpolation).

## Notes for a Raspberry Pi 2

- 1 GB is enough for **one** job at a time; the service serializes `yt-dlp` calls.
- Use Ethernet or a reliable USB Wi-Fi adapter; 100 Mbps is plenty for audio.
- Use a good power supply and a quality SD card. Consider moving logs and temp files to tmpfs
  (the systemd unit already uses `PrivateTmp=true`).
- The first `yt-dlp` run after boot can take a few seconds.
- If the Pi is offline, Cloud Run returns an extractor error and the web app can still analyze
  an uploaded audio file.
- If the home IP is also challenged, set `YTDLP_COOKIES_FILE` or `YTDLP_PROXY` in the
  environment file. Both have operational and terms-of-service implications.

## Tests

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest -q
```
