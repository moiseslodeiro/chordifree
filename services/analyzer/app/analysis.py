"""Análisis armónico con Essentia."""

from __future__ import annotations

import math
import os
from typing import Any

from .chords import PITCH_NAMES, decode_chords

ANALYZER_VERSION = os.environ.get("ANALYZER_VERSION", "essentia-1.5")
SAMPLE_RATE = 22050
# RhythmExtractor2013 asume 44100 Hz; con otra tasa los pulsos quedan a la mitad.
RHYTHM_SAMPLE_RATE = 44100
FRAME_SIZE = 4096
HOP_SIZE = 2048
MIN_DURATION = 0.5
BEATS_PER_BAR = 4
# Un segmento se considera silencio si su energía cae muy por debajo de la mediana.
SILENCE_RATIO = 0.08
LOW_CONFIDENCE = 0.35


class AnalyzerUnavailable(RuntimeError):
    """Essentia no está instalado o no pudo cargarse."""


def _load_essentia():
    try:
        from essentia.standard import (  # type: ignore
            ChordsDetection,
            ChordsDetectionBeats,
            FrameGenerator,
            KeyExtractor,
            LogSpectrum,
            MonoLoader,
            NNLSChroma,
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
        "KeyExtractor": KeyExtractor,
        "LogSpectrum": LogSpectrum,
        "MonoLoader": MonoLoader,
        "NNLSChroma": NNLSChroma,
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


def _rms(audio: Any, sample_rate: int, start: float, end: float) -> float:
    import numpy as np  # type: ignore

    first = max(0, min(len(audio), int(start * sample_rate)))
    last = max(first, min(len(audio), int(end * sample_rate)))
    if last <= first:
        return 0.0
    chunk = np.asarray(audio[first:last], dtype="float64")
    return float(np.sqrt(np.mean(chunk * chunk)))


def _apply_silence(
    segments: list[dict[str, Any]],
    audio: Any,
    sample_rate: int = SAMPLE_RATE,
) -> list[dict[str, Any]]:
    """Marca como silencio los tramos cuya energía queda muy por debajo de la mediana."""
    energies = [_rms(audio, sample_rate, item["start"], item["end"]) for item in segments]
    positives = [energy for energy in energies if energy > 0]
    if not positives:
        return segments
    reference = float(sorted(positives)[len(positives) // 2])
    threshold = max(1e-4, reference * SILENCE_RATIO)
    for segment, energy in zip(segments, energies):
        if energy < threshold:
            segment["label"] = None
            segment["confidence"] = 0.0
    return segments


def _smooth_chords(
    segments: list[dict[str, Any]],
    threshold: float = LOW_CONFIDENCE,
) -> list[dict[str, Any]]:
    """Elimina parpadeos aislados de baja confianza entre dos segmentos iguales."""
    for index in range(1, len(segments) - 1):
        previous = segments[index - 1]
        current = segments[index]
        following = segments[index + 1]
        if not previous.get("label") or not current.get("label") or not following.get("label"):
            continue
        if (
            previous["label"] == following["label"]
            and current["label"] != previous["label"]
            and _safe_float(current.get("confidence")) < threshold
        ):
            current["label"] = previous["label"]
            current["confidence"] = round(
                min(
                    _safe_float(previous.get("confidence")),
                    _safe_float(following.get("confidence")),
                ),
                3,
            )
    return segments


def _merge_segments(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    for segment in segments:
        previous = merged[-1] if merged else None
        if (
            previous
            and previous.get("label") == segment.get("label")
            and abs(segment["start"] - previous["end"]) <= 0.01
        ):
            previous["end"] = segment["end"]
            previous["confidence"] = max(
                _safe_float(previous.get("confidence")),
                _safe_float(segment.get("confidence")),
            )
        else:
            merged.append(dict(segment))
    return merged


def _compute_chroma(
    essentia: dict[str, Any], audio: Any
) -> tuple[Any, Any]:
    """Croma de NNLS con corrección de afinación y croma de bajos.

    NNLSChroma devuelve un croma de rango medio y otro grave alineados con el
    mismo espectro logarítmico; el grave ayuda a fijar la fundamental.
    """
    import numpy as np  # type: ignore

    frame_size = FRAME_SIZE
    spectrum_size = frame_size // 2 + 1
    windowing = essentia["Windowing"](type="blackmanharris62", size=frame_size)
    spectrum = essentia["Spectrum"](size=frame_size)
    log_spectrum = essentia["LogSpectrum"](
        frameSize=spectrum_size,
        sampleRate=SAMPLE_RATE,
        binsPerSemitone=3,
        nOctave=7,
    )
    nnls = essentia["NNLSChroma"](
        frameSize=spectrum_size,
        sampleRate=SAMPLE_RATE,
        chromaNormalization="L2",
        useNNLS=False,
    )

    log_frames: list[Any] = []
    mean_tuning: list[Any] = []
    local_tuning: list[float] = []
    for frame in essentia["FrameGenerator"](
        audio, frameSize=frame_size, hopSize=HOP_SIZE, startFromZero=True
    ):
        log_freq, tuning_mean, tuning_local = log_spectrum(spectrum(windowing(frame)))
        log_frames.append(log_freq)
        mean_tuning.append(tuning_mean)
        local_tuning.append(tuning_local)

    if not log_frames:
        empty = np.zeros((0, 12), dtype="float32")
        return empty, empty

    result = nnls(
        np.asarray(log_frames, dtype="float32"),
        np.asarray(mean_tuning[-1], dtype="float32"),
        np.asarray([local_tuning[-1]], dtype="float32"),
    )
    chroma = np.asarray(result[3], dtype="float32")
    bass = np.asarray(result[2], dtype="float32")
    return chroma, bass


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
    audio: Any = None,
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
    if audio is not None:
        segments = _apply_silence(segments, audio, SAMPLE_RATE)
    return _smooth_chords(segments)


def _detect_fixed_frame(
    essentia: dict[str, Any],
    hpcp: Any,
    duration: float,
    audio: Any = None,
):
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
    if audio is not None:
        segments = _apply_silence(segments, audio, SAMPLE_RATE)
    return _smooth_chords(segments)


def _extract_key(essentia: dict[str, Any], audio: Any) -> tuple[int, str] | None:
    """Tonalidad global con KeyExtractor de Essentia (perfiles sobre HPCP)."""
    try:
        key, scale, _strength = essentia["KeyExtractor"]()(audio)
    except Exception:
        return None
    if key not in PITCH_NAMES:
        return None
    mode = 'minor' if str(scale).lower().startswith('minor') else 'major'
    return PITCH_NAMES.index(key), mode


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

    chroma, bass_chroma = _compute_chroma(essentia, audio)
    beats = _extract_beats(essentia, audio, duration)
    key = _extract_key(essentia, audio)

    segments: list[dict[str, Any]] = []
    if len(beats) >= 2:
        try:
            segments = decode_chords(
                chroma, beats, duration, HOP_SIZE, SAMPLE_RATE, key, bass_chroma
            )
        except Exception:
            segments = []
        if segments:
            segments = _apply_silence(segments, audio, SAMPLE_RATE)
            segments = _smooth_chords(segments)

    if not segments:
        try:
            segments = _detect_with_beats(essentia, chroma, beats, duration, audio)
        except Exception:
            segments = _detect_fixed_frame(essentia, chroma, duration, audio)

    segments = _merge_segments(segments)

    return {
        "segments": segments,
        "duration": round(duration, 3),
        "beats": beats,
        "beatsPerBar": BEATS_PER_BAR,
        "analyzerVersion": ANALYZER_VERSION,
    }
