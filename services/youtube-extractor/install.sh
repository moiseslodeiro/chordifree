#!/usr/bin/env bash
# Install and configure the Chordifree YouTube extractor on Raspberry Pi OS/Debian.
# Run from the services/youtube-extractor directory: sudo ./install.sh
set -euo pipefail

SERVICE_NAME="chordifree-extractor"
SERVICE_USER="${SERVICE_USER:-chordifree}"
INSTALL_DIR="${INSTALL_DIR:-/opt/chordifree-extractor}"
ENV_FILE="${ENV_FILE:-/etc/chordifree-extractor.env}"
YTDLP_VERSION="${YTDLP_VERSION:-latest}"
PORT="${PORT:-8010}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: sudo ./install.sh

Environment overrides:
  SERVICE_USER      system user (default: chordifree)
  INSTALL_DIR       install directory (default: /opt/chordifree-extractor)
  ENV_FILE          environment file (default: /etc/chordifree-extractor.env)
  YTDLP_VERSION     yt-dlp release tag (default: latest)
  PORT              local port (default: 8010)

The script is idempotent: it keeps an existing token and restarts the service.
EOF
  exit 0
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer targets Raspberry Pi OS/Debian (apt)." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/app.py" || ! -f "$SCRIPT_DIR/requirements.txt" ]]; then
  echo "Run the script from the services/youtube-extractor directory." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/systemd/$SERVICE_NAME.service" ]]; then
  echo "Missing systemd/$SERVICE_NAME.service." >&2
  exit 1
fi

echo "Installing system packages..."
apt-get update
apt-get install -y python3-venv unzip curl ca-certificates openssl

if ! getent group "$SERVICE_USER" >/dev/null 2>&1; then
  groupadd --system "$SERVICE_USER"
fi
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --gid "$SERVICE_USER" --create-home \
    --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -o "$SERVICE_USER" -g "$SERVICE_USER" "$INSTALL_DIR"
install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0644 \
  "$SCRIPT_DIR/app.py" "$INSTALL_DIR/app.py"
install -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0644 \
  "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/requirements.txt"

if [[ ! -x "$INSTALL_DIR/.venv/bin/python" ]]; then
  echo "Creating Python virtual environment..."
  runuser -u "$SERVICE_USER" -- python3 -m venv "$INSTALL_DIR/.venv"
fi

echo "Installing Python dependencies..."
runuser -u "$SERVICE_USER" -- "$INSTALL_DIR/.venv/bin/pip" install --quiet --upgrade pip
runuser -u "$SERVICE_USER" -- "$INSTALL_DIR/.venv/bin/pip" install --quiet \
  -r "$INSTALL_DIR/requirements.txt"

case "$(uname -m)" in
  armv7l) asset="yt-dlp_linux_armv7l.zip" ;;
  aarch64|arm64) asset="yt-dlp_linux_aarch64.zip" ;;
  x86_64|amd64) asset="yt-dlp_linux.zip" ;;
  *)
    echo "Unsupported CPU architecture: $(uname -m). Pi 2 needs a 32-bit armv7 OS." >&2
    exit 1
    ;;
esac

if [[ "$YTDLP_VERSION" == "latest" ]]; then
  ytdlp_url="https://github.com/yt-dlp/yt-dlp/releases/latest/download/$asset"
else
  ytdlp_url="https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/$asset"
fi

echo "Installing yt-dlp ($asset)..."
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
curl -fsSL "$ytdlp_url" -o "$tmpdir/yt-dlp.zip"
unzip -o "$tmpdir/yt-dlp.zip" -d /usr/local/bin >/dev/null
chmod 0755 /usr/local/bin/yt-dlp
/usr/local/bin/yt-dlp --version >/dev/null

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Generating extractor token..."
  token="$(openssl rand -hex 32)"
  cat >"$ENV_FILE" <<EOF
EXTRACTOR_TOKEN=$token
YTDLP_PATH=/usr/local/bin/yt-dlp
EXTRACTOR_TIMEOUT_SECONDS=180
EOF
  chown root:root "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
else
  echo "Keeping existing $ENV_FILE"
fi

sed \
  -e "s|/etc/chordifree-extractor.env|$ENV_FILE|g" \
  -e "s|127.0.0.1:8010|127.0.0.1:$PORT|g" \
  "$SCRIPT_DIR/systemd/$SERVICE_NAME.service" \
  > "/etc/systemd/system/$SERVICE_NAME.service"
chmod 0644 "/etc/systemd/system/$SERVICE_NAME.service"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"

for _ in $(seq 1 20); do
  if curl -fsS -m 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! systemctl is-active --quiet "$SERVICE_NAME"; then
  echo "The service did not start. Check:" >&2
  echo "  sudo journalctl -u $SERVICE_NAME -n 80 --no-pager" >&2
  exit 1
fi

token="$(sed -n 's/^EXTRACTOR_TOKEN=//p' "$ENV_FILE")"

cat <<EOF

Chordifree YouTube extractor installed.

  Health:  curl http://127.0.0.1:$PORT/health
  Logs:    sudo journalctl -u $SERVICE_NAME -f
  Token:   $token

The service is supervised by systemd and restarts automatically on failure.
It listens on 127.0.0.1:$PORT only; do not open that port on your router.

Expose it with a tunnel, for example Tailscale Funnel:

  curl -fsSL https://tailscale.com/install.sh | sh
  sudo tailscale up
  sudo tailscale funnel --bg $PORT

Or Cloudflare Tunnel (requires a domain in Cloudflare):

  cloudflared tunnel login
  cloudflared tunnel create chordifree-extractor
  cloudflared tunnel route dns chordifree-extractor extractor.example.com
  # point the tunnel ingress to http://127.0.0.1:$PORT

Then set in deploy/gcp/terraform.tfvars:

  youtube_extractor_url   = "https://your-tunnel-hostname"
  youtube_extractor_token = "$token"

For Docker instead of systemd, see README.md.
EOF
