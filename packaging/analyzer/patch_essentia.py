"""Patch the Essentia checkout used to build the Windows analyzer wheel.

Usage:
    python packaging/analyzer/patch_essentia.py essentia-src

The Windows wheel is built from the open Essentia PR (MTG/essentia#1514).
This script keeps our build fixes reviewable and idempotent instead of
embedding long inline patches in the workflow.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

VERSION_OLD = "        dev_commits = git_version.split('-')[-2] if git_version else ''"
VERSION_NEW = (
    "        import re\n"
    "        match = re.search(r'-(\\d+)-g[0-9a-f]+$', git_version or '')\n"
    "        dev_commits = match.group(1) if match else '0'"
)

SAMPLE_FMTS_RE = re.compile(
    r"  // If codec provides supported list.*?\n  \}\n(?=  _codecCtx->sample_fmt = desired_fmt;)",
    re.DOTALL,
)
SAMPLE_FMTS_NEW = (
    "  // ffmpeg 9 removed AVCodec::sample_fmts. The analyzer only decodes\n"
    "  // audio, so keep the codec-appropriate default and skip the query.\n"
)


def patch_version(root: Path) -> str:
    path = root / "setup.py"
    text = path.read_text(encoding="utf-8")
    if VERSION_OLD not in text:
        return "setup.py: already patched or changed upstream"
    path.write_text(text.replace(VERSION_OLD, VERSION_NEW), encoding="utf-8")
    return "setup.py: version fallback patched"


def patch_ffmpeg9_sample_fmts(root: Path) -> str:
    path = root / "src/essentia/utils/audiocontext.cpp"
    text = path.read_text(encoding="utf-8")
    new_text, replacements = SAMPLE_FMTS_RE.subn(SAMPLE_FMTS_NEW, text)
    if replacements == 0:
        if "ffmpeg 9 removed AVCodec::sample_fmts" in text:
            return "audiocontext.cpp: already patched"
        raise SystemExit("audiocontext.cpp: sample_fmts block not found")
    if replacements != 1:
        raise SystemExit(f"audiocontext.cpp: expected 1 block, found {replacements}")
    path.write_text(new_text, encoding="utf-8")
    return "audiocontext.cpp: ffmpeg 9 compatibility patched"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch_essentia.py <essentia-src>")

    root = Path(sys.argv[1]).resolve()
    if not (root / "setup.py").is_file():
        raise SystemExit(f"not an Essentia checkout: {root}")

    for patch in (patch_version, patch_ffmpeg9_sample_fmts):
        print(patch(root))


if __name__ == "__main__":
    main()
