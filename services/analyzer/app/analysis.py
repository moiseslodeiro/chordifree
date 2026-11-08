"""Análisis armónico con Essentia."""

from __future__ import annotations

import math
import os
from typing import Any

ANALYZER_VERSION = os.environ.get("ANALYZER_VERSION", "essentia-1.2")
SAMPLE_RATE = 22050
# RhythmExtractor2013 asume 44100 Hz; con otra tasa los pulsos quedan a la mitad.
RHYTHM_SAMPLE_RATE = 44100
FRAME_SIZE = 4096
HOP_SIZE = 2048
MIN_DURATION = 0.5
BEATS_PER_BAR = 4


class AnalyzerUnavailable(RuntimeError):
    """Essentia no está instalado o no pudo cargarse."""


def _load_essentia():
    try:
        from essentia.standard import (  # type: ignore
            ChordsDetection,
            ChordsDetectionBeats,
            FrameGenerator,
            HPCP,
            MonoLoader,
            Resample,
            RhythmExtractor2013,
            SpectralPeaks,
            Spectrum,
            Windowing,
        )
    except Exception as exc:  # pragma: no cover - depende del entorno
        raise AnalyzerUnavailable(f"Essentia no disponible: {exc}") from exc
    return {
        "ChordsDetection": ChordsDetection,
        "ChordsDetectionBeats": ChordsDetectionBeats,
        "FrameGenerator": FrameGenerator,
        "HPCP": HPCP,
        "MonoLoader": MonoLoader,
        "Resample": Resample,
        "RhythmExtractor2013": RhythmExtractor2013,
        "SpectralPeaks": SpectralPeaks,
        "Spectrum": Spectrum,
        "Windowing": Windowing,
    }


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if math.isfinite(result) else default


def _segment(start: float, end: float, label: str, confidence: float) -> dict[str, Any] | None:
    start = max(0.0, _safe_float(start))
    end = max(start, _safe_float(end))
    if end - start <= 1e-6:
        return None
    clean = label.strip() if label else ""
    return {
        "start": round(start, 3),
        "end": round(end, 3),
        "label": clean or None,
        "confidence": round(max(0.0, min(1.0, _safe_float(confidence))), 3),
    }


def _compute_hpcp(essentia: dict[str, Any], audio: Any) -> Any:
    import numpy as np  # type: ignore

    windowing = essentia["Windowing"](type="blackmanharris62")
    spectrum = essentia["Spectrum"]()
    peaks = essentia["SpectralPeaks"](
        sampleRate=SAMPLE_RATE,
        minFrequency=40,
        maxFrequency=5000,
        maxPeaks=60,
        orderBy="magnitude",
    )
    hpcp_algo = essentia["HPCP"](
        size=12,
        sampleRate=SAMPLE_RATE,
        minFrequency=40,
        maxFrequency=5000,
        referenceFrequency=440,
        normalized="unitMax",
    )

    frames = []
    for frame in essentia["FrameGenerator"](
        audio, frameSize=FRAME_SIZE, hopSize=HOP_SIZE, startFromZero=True
    ):
        spectrum_frame = spectrum(windowing(frame))
        frequencies, magnitudes = peaks(spectrum_frame)
        frames.append(hpcp_algo(frequencies, magnitudes))

    if not frames:
        return np.zeros((0, 12), dtype="float32")
    return np.asarray(frames, dtype="float32")


def _extract_beats(essentia: dict[str, Any], audio: Any, duration: float) -> list[float]:
    """Extrae y sanea los pulsos detectados, sin fallar si el ritmo no es claro."""
    try:
        resample = essentia["Resample"](
            inputSampleRate=SAMPLE_RATE,
            outputSampleRate=RHYTHM_SAMPLE_RATE,
            quality=2,
        )
        rhythm = essentia["RhythmExtractor2013"](method="multifeature")
        _, beats, _, _, _ = rhythm(resample(audio))
    except Exception:
        return []

    clean: list[float] = []
    values: list[float] = []
    for beat in beats:
        value = _safe_float(beat, -1.0)
        if not math.isfinite(value) or value < 0 or value > duration:
            continue
        values.append(round(value, 3))
    for value in sorted(values):
        if not clean or value > clean[-1]:
            clean.append(value)
    return clean


def _detect_with_beats(
    essentia: dict[str, Any],
    hpcp: Any,
    beats: list[float],
    duration: float,
):
    if len(beats) < 2:
        raise ValueError("No se detectaron suficientes pulsos")
    chords, strength = essentia["ChordsDetectionBeats"](
        hopSize=HOP_SIZE, sampleRate=SAMPLE_RATE
    )(hpcp, beats)
    segments = []
    for index, (label, score) in enumerate(zip(chords, strength)):
        start = beats[index]
        end = beats[index + 1] if index + 1 < len(beats) else duration
        segment = _segment(start, min(duration, end), label, score)
        if segment:
            segments.append(segment)
    if not segments:
        raise ValueError("Sin segmentos por pulsos")
    last = segments[-1]
    if last["end"] < duration:
        last["end"] = round(duration, 3)
    return segments


def _detect_fixed_frame(essentia: dict[str, Any], hpcp: Any, duration: float):
    chords, strength = essentia["ChordsDetection"](
        hopSize=HOP_SIZE, sampleRate=SAMPLE_RATE, windowSize=2
    )(hpcp)
    frame_duration = HOP_SIZE / SAMPLE_RATE
    segments = []
    for index, (label, score) in enumerate(zip(chords, strength)):
        start = index * frame_duration
        end = min(duration, start + frame_duration)
        segment = _segment(start, end, label, score)
        if segment:
            segments.append(segment)
    return segments


def analyze_file(path: str) -> dict[str, Any]:
    """Analiza un archivo de audio y devuelve segmentos crudos con etiquetas."""
    essentia = _load_essentia()
    audio = essentia["MonoLoader"](filename=path, sampleRate=SAMPLE_RATE)()
    duration = _safe_float(len(audio) / SAMPLE_RATE)
    if duration <= 0:
        return {
            "segments": [],
            "duration": 0.0,
            "beats": [],
            "beatsPerBar": BEATS_PER_BAR,
            "analyzerVersion": ANALYZER_VERSION,
        }

    hpcp = _compute_hpcp(essentia, audio)
    beats = _extract_beats(essentia, audio, duration)

    segments: list[dict[str, Any]] = []
    try:
        segments = _detect_with_beats(essentia, hpcp, beats, duration)
    except Exception:
        segments = _detect_fixed_frame(essentia, hpcp, duration)

    return {
        "segments": segments,
        "duration": round(duration, 3),
        "beats": beats,
        "beatsPerBar": BEATS_PER_BAR,
        "analyzerVersion": ANALYZER_VERSION,
    }
