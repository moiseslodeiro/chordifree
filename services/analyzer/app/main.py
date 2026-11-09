from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from .analysis import ANALYZER_VERSION, AnalyzerUnavailable, analyze_file

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"}

app = FastAPI(title="Chordifree Analyzer", version=ANALYZER_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "analyzerVersion": ANALYZER_VERSION}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)) -> JSONResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail="Unsupported audio format")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=422, detail="Empty file")

    handle, path = tempfile.mkstemp(suffix=suffix)
    os.close(handle)
    try:
        Path(path).write_bytes(payload)
        result = analyze_file(path)
    except AnalyzerUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - decoding errors
        raise HTTPException(status_code=422, detail=f"Could not analyze the audio: {exc}") from exc
    finally:
        Path(path).unlink(missing_ok=True)

    return JSONResponse(result)
