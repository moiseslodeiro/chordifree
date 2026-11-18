# Raspberry Pi YouTube extractor

This guide installs the optional residential YouTube extractor on a headless Raspberry Pi and
publishes it through a tunnel. The extractor only runs `yt-dlp`; the analyzer and the user
library stay in Cloud Run or on the local machine.

The recommended path is **Raspberry Pi OS Lite 64-bit + Ethernet + Tailscale Funnel**. A
Cloudflare named tunnel works too, but it requires a domain (zone) in your Cloudflare account.

## What you need

- Raspberry Pi 3 Model B or newer. A Pi 3 has enough CPU and RAM for one extraction at a time.
- A microSD card (16 GB or more is comfortable).
- Ethernet. Wi-Fi works, but Ethernet avoids `wpa_supplicant`/NetworkManager differences on
  headless installs.
- A Tailscale account (free personal plan is enough) or a Cloudflare account with a domain.
- About 15 minutes.

## 1. Flash Raspberry Pi OS Lite 64-bit

Download the current Lite 64-bit image from the Raspberry Pi download server and verify it:

```bash
curl -fLO https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-10-06/2026-10-06-raspios-trixie-arm64-lite.img.xz
curl -fLO https://downloads.raspberrypi.com/raspios_lite_arm64/images/raspios_lite_arm64-2026-10-06/2026-10-06-raspios-trixie-arm64-lite.img.xz.sha256
sha256sum -c 2026-10-06-raspios-trixie-arm64-lite.img.xz.sha256
```

Write it to the card. Replace `/dev/sdX` with the card device, never your system disk:

```bash
xz -dc 2026-10-06-raspios-trixie-arm64-lite.img.xz |
  sudo dd of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

Raspberry Pi Imager is a safer alternative if you prefer a graphical tool. Select
**Raspberry Pi OS Lite (64-bit)**, choose the card, and use the customisation screen to set the
hostname, user, SSH and, if needed, Wi-Fi.

### Headless boot files instead of Imager

If you wrote the image with `dd`, mount the `bootfs` partition and create two files:

```bash
sudo mount /dev/sdX1 /mnt
sudo touch /mnt/ssh
HASH="$(openssl passwd -6 'choose-a-strong-password')"
printf 'chordifree:%s\n' "$HASH" | sudo tee /mnt/userconf.txt
sudo chmod 600 /mnt/userconf.txt
sync
sudo umount /mnt
```

`ssh` enables SSH. `userconf.txt` creates the first user, adds it to the normal groups and
enables password login. For Ethernet, no Wi-Fi configuration is needed. Remove the card,
insert it into the Pi, connect Ethernet and power it on.

## 2. Find the Pi and log in

Wait two or three minutes for the first boot, then try:

```bash
ssh chordifree@raspberrypi.local
```

If mDNS does not resolve, look up the lease in your router or scan the LAN. Confirm the board:

```bash
hostname
uname -m          # aarch64 on a 64-bit Pi 3/4/5
cat /etc/os-release
```

Update the base system:

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

## 3. Install the extractor

Copy or clone this repository on the Pi, then run the installer:

```bash
git clone https://github.com/moiseslodeiro/chordifree.git
cd chordifree/services/youtube-extractor
sudo ./install.sh
```

The script installs the Python venv, `yt-dlp`, a systemd unit and a shared token at
`/etc/chordifree-extractor.env`. It keeps the token on later runs. Check it:

```bash
systemctl status chordifree-extractor --no-pager
curl -fsS http://127.0.0.1:8010/health
TOKEN="$(sudo sed -n 's/^EXTRACTOR_TOKEN=//p' /etc/chordifree-extractor.env)"
curl -fsS -X POST http://127.0.0.1:8010/probe \
  -H "Content-Type: application/json" \
  -H "X-Chordifree-Token: $TOKEN" \
  -d '{"videoId":"dQw4w9WgXcQ"}'
```

The service listens on `127.0.0.1:8010` only. Never forward that port on your router.

Recent `yt-dlp` releases publish `aarch64` and `x86_64` as standalone binaries and only
`armv7l` as a ZIP. Keep `install.sh` up to date with the repository so the download names match.

## 4. Publish it through a tunnel

### Option A: Tailscale Funnel (recommended, no domain)

Install Tailscale and start the login:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Open the URL printed by `tailscale up`, sign in, and authorise the Pi. Then enable Funnel for
the node in the admin console if Tailscale asks for it, and expose the service:

```bash
sudo tailscale funnel --bg 8010
tailscale funnel status
```

The output gives a stable HTTPS URL:

```text
https://raspberrypi.<your-tailnet>.ts.net
```

Verify it from another machine:

```bash
TOKEN="$(sudo sed -n 's/^EXTRACTOR_TOKEN=//p' /etc/chordifree-extractor.env)"
curl -fsS https://raspberrypi.<your-tailnet>.ts.net/health
curl -fsS -X POST https://raspberrypi.<your-tailnet>.ts.net/probe \
  -H "Content-Type: application/json" \
  -H "X-Chordifree-Token: $TOKEN" \
  -d '{"videoId":"dQw4w9WgXcQ"}'
```

`tailscaled` is enabled at boot and keeps the Funnel configuration. If Funnel is not enabled
for your tailnet yet, Tailscale prints the admin URL to enable it.

### Option B: Cloudflare named tunnel (requires a domain)

Cloudflare only lets you create a public hostname on a **zone you control**. If the account has
no domain, the authorisation page will show an empty zone list and you cannot finish this path.

1. Add the domain to Cloudflare and wait until it is **Active**.
2. Install `cloudflared`:

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg |
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' |
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
```

3. Log in and create the tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create chordifree-extractor
cloudflared tunnel route dns chordifree-extractor extractor.example.com
```

4. Add the public hostname in **Zero Trust → Networks → Tunnels → chordifree-extractor →
   Public Hostname**:

```text
Subdomain: extractor
Domain:    example.com
Service:   HTTP
URL:       127.0.0.1:8010
```

5. Run the connector as a service. Prefer a token file owned by an unprivileged user over
   putting the token on the command line:

```bash
sudo install -m 0600 -o chordifree -g chordifree /path/to/tunnel-token /etc/chordifree-tunnel.token
sudo tee /etc/systemd/system/cloudflared-chordifree.service >/dev/null <<'EOF'
[Unit]
Description=Cloudflare Tunnel for the Chordifree extractor
After=network-online.target chordifree-extractor.service
Wants=network-online.target

[Service]
User=chordifree
Group=chordifree
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token-file /etc/chordifree-tunnel.token
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-chordifree.service
```

The public URL is `https://extractor.example.com`. Keep the token file `0600` and rotate the
token from the Cloudflare dashboard if it is ever exposed.

### Option C: Cloudflare quick tunnel (testing only)

A quick tunnel needs no domain or account:

```bash
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8010
```

It prints a `https://<random>.trycloudflare.com` URL. The URL changes every time the process
restarts and Cloudflare gives it no uptime guarantee. Use it to validate the flow, then move to
Tailscale Funnel or a named tunnel.

## 5. Point Chordifree at the extractor

Set both values wherever the API runs. For Cloud Run, use `deploy/gcp/terraform.tfvars`:

```hcl
youtube_extractor_url   = "https://raspberrypi.<your-tailnet>.ts.net"
youtube_extractor_token = "the value of EXTRACTOR_TOKEN on the Pi"
```

For a local server, export them before starting it:

```bash
export YOUTUBE_EXTRACTOR_URL="https://raspberrypi.<your-tailnet>.ts.net"
export YOUTUBE_EXTRACTOR_TOKEN="the value of EXTRACTOR_TOKEN on the Pi"
pnpm dev
```

When `YOUTUBE_EXTRACTOR_URL` is set, the server uses the Pi for YouTube probe, search and
download. If the extractor is offline, YouTube analysis fails with `EXTRACTOR_UNAVAILABLE`,
but audio uploads keep working.

## 6. Status in the web app

When the extractor is configured, `GET /api/health` adds:

```json
{
  "status": "ok",
  "analyzer": "ok",
  "analyzerVersion": "essentia-1.6",
  "extractor": "ok",
  "extractorVersion": "0.1.0"
}
```

The home screen shows **YouTube extractor: Available / Unavailable / Checking** only when the
API reports `features.youtube === "extractor"`. Local and direct-YouTube modes do not show it.

Completed analyses are also cached in Firestore, so a previously analyzed video is reused
without calling the Pi again. Search results show **Analyzed** and the action changes to
**Open**. Reanalyze explicitly bypasses the cache.

## 7. Operations

### Update

```bash
cd chordifree
git pull
cd services/youtube-extractor
sudo ./install.sh
```

The installer keeps the environment file and token safe. It updates the venv, `yt-dlp` and the
systemd unit.

### Logs and health

```bash
sudo journalctl -u chordifree-extractor -f
curl -fsS http://127.0.0.1:8010/health
tailscale funnel status
```

### Rotate the extractor token

```bash
sudo sh -c 'printf "EXTRACTOR_TOKEN=%s\nYTDLP_PATH=/usr/local/bin/yt-dlp\nEXTRACTOR_TIMEOUT_SECONDS=180\n" "$(openssl rand -hex 32)" > /etc/chordifree-extractor.env'
sudo chmod 600 /etc/chordifree-extractor.env
sudo systemctl restart chordifree-extractor
```

Then update `youtube_extractor_token` in `terraform.tfvars` and redeploy.

### Security

- Keep the extractor on `127.0.0.1:8010`; the tunnel is outbound-only.
- Keep `/etc/chordifree-extractor.env` and `/etc/chordifree-tunnel.token` at mode `0600`.
- Do not expose the Pi's SSH or the extractor port on the router.
- Use a long random `EXTRACTOR_TOKEN`.
- Rotate tokens after sharing logs or screenshots that contain them.

## 8. Troubleshooting

| Symptom                               | Check                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `EXTRACTOR_UNAVAILABLE`               | `systemctl status chordifree-extractor`; `/health` on the Pi                            |
| `401` on probe                        | The token in Chordifree must match `EXTRACTOR_TOKEN` on the Pi                          |
| `EXTRACTOR_BUSY`                      | The Pi handles one extraction at a time; retry later                                    |
| `YOUTUBE_BLOCKED`                     | The home IP is also challenged; try cookies or a proxy                                  |
| Funnel URL fails TLS                  | Wait for the certificate; retry, then `tailscale cert`                                  |
| Named tunnel cannot authorise         | Add a domain/zone to Cloudflare first                                                   |
| `yt-dlp: No such file` during install | Update `install.sh`; current assets are named `yt-dlp_linux_aarch64` and `yt-dlp_linux` |
