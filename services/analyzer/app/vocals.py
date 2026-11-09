"""Sung vocal detection to align the lyrics with the vocal sections.

Uses YAMNet (AudioSet embeddings) and Essentia's voice/instrumental
classifier. Both models run with ONNX Runtime, without TensorFlow.
"""

from __future__ import annotations

import hashlib
import math
import os
import shutil
import urllib.request
from pathlib import Path
from typing import Any

SAMPLE_RATE = 22050
VOCAL_SAMPLE_RATE = 16000
# YAMNet produces one frame every 0.48 s (0.96 s patch with a 0.48 s stride).
YAMNET_HOP = 0.48
VOICE_THRESHOLD = 0.8
SMOOTH_FRAMES = 5
CLOSE_GAP_FRAMES = 6
MIN_REGION_SECONDS = 3.0

MODEL_DIR = Path(
    os.environ.get(
        "ANALYZER_MODEL_DIR",
        Path(__file__).resolve().parent.parent / "models",
    )
)
YAMNET_PATH = MODEL_DIR / "yamnet.onnx"
VOICE_PATH = MODEL_DIR / "voice_instrumental.onnx"
YAMNET_SHA256 = "04e27fca08e7a3aea2630d1a63a51e6b437c803e0ff6e26399f80870ac251dda"
VOICE_SHA256 = "f619b35a95a44d8c3ec27a205d4c93ec988401fca443ff552ed007b3f1c018a0"
YAMNET_URL = (
    "https://huggingface.co/jafet21/yamnetonnx/resolve/"
    "337f563004630f00673d4a773a0d657d0233ce56/yamnet.onnx"
)
VOICE_URL = (
    "https://essentia.upf.edu/models/classification-heads/voice_instrumental/"
    "voice_instrumental-audioset-yamnet-1.onnx"
)
ALLOW_DOWNLOAD = os.environ.get("ANALYZER_DOWNLOAD_MODELS", "1") != "0"

_sessions: dict[str, Any] = {}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _ensure_model(path: Path, url: str, expected_sha256: str) -> bool:
    if path.is_file() and path.stat().st_size > 0:
        return True
    if not ALLOW_DOWNLOAD:
        return False
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix(path.suffix + ".part")
        with urllib.request.urlopen(url, timeout=120) as response:
            with partial.open("wb") as target:
                shutil.copyfileobj(response, target)
        if _sha256(partial) != expected_sha256:
            partial.unlink(missing_ok=True)
            return False
        partial.replace(path)
        return True
    except Exception:
        return False


def _session(path: Path) -> Any:
    import onnxruntime as ort  # type: ignore

    key = str(path)
    cached = _sessions.get(key)
    if cached is None:
        cached = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        _sessions[key] = cached
    return cached


def regions_from_probabilities(
    probabilities: Any,
    hop: float = YAMNET_HOP,
    threshold: float = VOICE_THRESHOLD,
    smooth_frames: int = SMOOTH_FRAMES,
    close_gap_frames: int = CLOSE_GAP_FRAMES,
    min_region_seconds: float = MIN_REGION_SECONDS,
    duration: float | None = None,
) -> list[dict[str, float]]:
    """Converts a vocal probability curve into vocal regions."""
    import numpy as np  # type: ignore

    values = np.asarray(probabilities, dtype="float64").reshape(-1)
    if values.size == 0:
        return []

    size = max(1, int(smooth_frames))
    if size > 1:
        kernel = np.ones(size, dtype="float64") / size
        smoothed = np.convolve(values, kernel, mode="same")
    else:
        smoothed = values

    active = smoothed >= threshold
    if close_gap_frames > 0:
        closed = active.copy()
        index = 0
        while index < len(closed):
            if closed[index]:
                index += 1
                continue
            end = index
            while end < len(closed) and not closed[end]:
                end += 1
            if index > 0 and end < len(closed) and end - index <= close_gap_frames:
                closed[index:end] = True
            index = end
        active = closed

    min_frames = max(1, int(math.ceil(min_region_seconds / hop)))
    regions: list[dict[str, float]] = []
    index = 0
    while index < len(active):
        if not active[index]:
            index += 1
            continue
        end = index
        while end < len(active) and active[end]:
            end += 1
        if end - index >= min_frames:
            start_time = round(index * hop, 3)
            end_time = round(end * hop, 3)
            if duration is not None and math.isfinite(duration):
                end_time = round(min(end_time, duration), 3)
            if end_time > start_time:
                regions.append({"start": start_time, "end": end_time})
        index = end
    return regions


def detect_vocal_regions(
    essentia: dict[str, Any],
    audio: Any,
    duration: float,
) -> list[dict[str, float]]:
    """Returns the regions with sung vocals; an empty list if there are no models."""
    try:
        import numpy as np  # type: ignore

        if not _ensure_model(YAMNET_PATH, YAMNET_URL, YAMNET_SHA256):
            return []
        if not _ensure_model(VOICE_PATH, VOICE_URL, VOICE_SHA256):
            return []

        resample = essentia["Resample"](
            inputSampleRate=SAMPLE_RATE,
            outputSampleRate=VOCAL_SAMPLE_RATE,
            quality=2,
        )
        audio16 = np.asarray(resample(audio), dtype="float32")
        if audio16.size == 0:
            return []

        yamnet = _session(YAMNET_PATH)
        _scores, embeddings, _spectrogram = yamnet.run(
            None, {"waveform": audio16}
        )
        classifier = _session(VOICE_PATH)
        activations = classifier.run(
            None, {"embeddings": np.asarray(embeddings, dtype="float32")}
        )[0]
        probabilities = np.asarray(activations, dtype="float64")[:, 1]
        return regions_from_probabilities(probabilities, duration=duration)
    except Exception:
        return []
