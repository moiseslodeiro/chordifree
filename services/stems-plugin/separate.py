#!/usr/bin/env python3
"""Cross-platform entry point for the Chordifree stems plugin.

Usage: separate.py <input audio> <output directory>

Runs Demucs and the reference bass/drum transcription. The managed desktop
install points the plugin manifest at this script, so it does not depend on
bash or on the virtualenv living in a fixed home directory.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

STEMS = ("vocals", "drums", "bass", "other")
NOTES = ("bass", "drums")


def run(command: list[str], work: Path) -> None:
    completed = subprocess.run(
        command,
        cwd=work,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or "").strip().splitlines()
        message = detail[-1] if detail else f"exit code {completed.returncode}"
        raise RuntimeError(f"{Path(command[0]).name} failed: {message}")


def separate(input_path: Path, output_dir: Path) -> None:
    work = Path(tempfile.mkdtemp(prefix="chordifree-stems-"))
    try:
        ffmpeg = os.environ.get("FFMPEG_PATH") or "ffmpeg"
        normalized = work / "input.wav"
        run(
            [
                ffmpeg,
                "-y",
                "-v",
                "error",
                "-i",
                str(input_path),
                "-ac",
                "2",
                "-ar",
                "44100",
                str(normalized),
            ],
            work,
        )
        run([sys.executable, "-m", "demucs", "-n", "htdemucs", "-o", str(work), str(normalized)], work)

        output_dir.mkdir(parents=True, exist_ok=True)
        for stem in STEMS:
            matches = sorted(work.rglob(f"{stem}.wav"))
            if not matches:
                raise RuntimeError(f"Demucs did not produce {stem}.wav")
            shutil.copyfile(matches[0], output_dir / f"{stem}.wav")

        here = Path(__file__).resolve().parent
        for stem in NOTES:
            run(
                [
                    sys.executable,
                    str(here / "transcribe.py"),
                    stem,
                    str(output_dir / f"{stem}.wav"),
                    str(output_dir / f"{stem}.notes.json"),
                ],
                work,
            )
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: separate.py <input audio> <output directory>", file=sys.stderr)
        return 2
    try:
        separate(Path(sys.argv[1]), Path(sys.argv[2]))
    except Exception as error:  # noqa: BLE001 - the server shows the message.
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
