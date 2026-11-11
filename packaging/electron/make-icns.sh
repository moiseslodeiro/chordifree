#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
source_png="$here/assets/icon.png"
iconset="$here/assets/icon.iconset"
output="$here/assets/icon.icns"

if ! command -v sips >/dev/null || ! command -v iconutil >/dev/null; then
  echo "sips and iconutil are required to build the macOS icon" >&2
  exit 1
fi

rm -rf "$iconset" "$output"
mkdir -p "$iconset"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$source_png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done

sips -z 1024 1024 "$source_png" --out "$iconset/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$iconset" -o "$output"
rm -rf "$iconset"
echo "Created $output"
