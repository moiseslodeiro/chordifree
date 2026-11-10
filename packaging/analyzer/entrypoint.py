"""Entry point for the frozen FastAPI analyzer sidecar."""

from __future__ import annotations

import os
import sys
from pathlib import Path


def bundle_root() -> Path:
    frozen = getattr(sys, "_MEIPASS", None)
    if frozen:
        return Path(frozen)
    return Path(__file__).resolve().parent


os.environ.setdefault("ANALYZER_MODEL_DIR", str(bundle_root() / "models"))
os.environ.setdefault("ANALYZER_DOWNLOAD_MODELS", "0")

import uvicorn  # noqa: E402

from app.main import app  # noqa: E402


if __name__ == "__main__":
    port = int(os.environ.get("ANALYZER_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
