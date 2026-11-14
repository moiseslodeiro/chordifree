#!/usr/bin/env bash
# Generate a WAV fixture with a C - F - G progression, two seconds per chord.
# Used by the smoke test to check the timeline end to end.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output="${1:-$here/chords.wav}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mix_chord() {
  local name="$1" first="$2" second="$3" third="$4"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "sine=frequency=${first}:duration=2:sample_rate=22050" \
    -f lavfi -i "sine=frequency=${second}:duration=2:sample_rate=22050" \
    -f lavfi -i "sine=frequency=${third}:duration=2:sample_rate=22050" \
    -filter_complex "[0:a][1:a][2:a]amix=inputs=3:normalize=0,volume=0.35[a]" \
    -map "[a]" -ac 1 -ar 22050 -c:a pcm_s16le "$work/${name}.wav"
}

# C major, F major and G major.
mix_chord c 261.63 329.63 392.00
mix_chord f 349.23 440.00 523.25
mix_chord g 392.00 493.88 587.33

printf "file '%s'\n" "$work/c.wav" "$work/f.wav" "$work/g.wav" > "$work/list.txt"
ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "$work/list.txt" -c copy "$output"

echo "Fixture written to $output"
