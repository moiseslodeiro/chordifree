"""Reconocimiento de acordes con prior de tonalidad y suavizado Viterbi."""

from __future__ import annotations

import math
from typing import Any

PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

QUALITIES: list[tuple[str, str, tuple[int, ...]]] = [
    ("major", "", (0, 4, 7)),
    ("minor", "m", (0, 3, 7)),
    ("dim", "dim", (0, 3, 6)),
]

DIATONIC_MAJOR = {
    0: "major",
    2: "minor",
    4: "minor",
    5: "major",
    7: "major",
    9: "minor",
    11: "dim",
}
DIATONIC_MINOR = {
    0: "minor",
    2: "dim",
    3: "major",
    5: "minor",
    7: "minor",
    8: "major",
    10: "major",
    11: "dim",
}

# Ventana de croma en pulsos: suaviza el ataque del acorde sin borrar cambios.
CHROMA_WINDOW_BEATS = 1.0


def _normalize(vector: Any) -> Any:
    import numpy as np  # type: ignore

    norm = float(np.linalg.norm(vector))
    return vector / norm if norm > 1e-9 else vector


def _templates() -> tuple[list[str], Any]:
    import numpy as np  # type: ignore

    names: list[str] = []
    rows: list[Any] = []
    weights = {0: 1.0, 3: 0.9, 4: 0.9, 6: 0.8, 7: 0.8}
    for quality, suffix, intervals in QUALITIES:
        for root in range(12):
            vector = np.zeros(12, dtype="float64")
            for interval in intervals:
                vector[(root + interval) % 12] = weights.get(interval, 0.8)
            rows.append(_normalize(vector))
            names.append(f"{PITCH_NAMES[root]}{suffix}")
    return names, np.asarray(rows, dtype="float64")


def _diatonic_states(names: list[str], tonic: int, mode: str) -> set[int]:
    table = DIATONIC_MAJOR if mode == "major" else DIATONIC_MINOR
    desired = {(tonic + degree) % 12: quality for degree, quality in table.items()}
    if mode == "minor":
        # La dominante mayor y el séptimo grado disminuido son habituales en menor armónica.
        desired[(tonic + 7) % 12] = "major"
    indexes: set[int] = set()
    for index, name in enumerate(names):
        for root in range(12):
            for quality, suffix, _intervals in QUALITIES:
                if name == f"{PITCH_NAMES[root]}{suffix}":
                    expected = desired.get(root)
                    if expected == quality:
                        indexes.add(index)
                    break
    return indexes


def estimate_key(
    chroma: Any,
    top_states: Any = None,
    names: list[str] | None = None,
) -> tuple[int, str]:
    """Estima tónica y modo combinando Krumhansl con la cobertura diatónica."""
    import numpy as np  # type: ignore

    vector = _normalize(np.asarray(chroma, dtype="float64"))
    if not np.any(vector):
        return 0, "major"

    states = np.asarray(top_states, dtype="int32") if top_states is not None else None
    best_tonic = 0
    best_mode = "major"
    best_score = -math.inf
    for mode, profile in (("major", MAJOR_PROFILE), ("minor", MINOR_PROFILE)):
        template = np.asarray(profile, dtype="float64")
        for tonic in range(12):
            rotated = template[(np.arange(12) - tonic) % 12]
            score = float(np.dot(vector, _normalize(rotated)))
            if states is not None and names is not None and len(states) > 0:
                diatonic = _diatonic_states(names, tonic, mode)
                coverage = float(np.mean([int(state) in diatonic for state in states]))
                score += coverage * 0.5
            if score > best_score:
                best_score = score
                best_tonic = tonic
                best_mode = mode
    return best_tonic, best_mode


def _beat_chroma(
    hpcp: Any,
    beats: list[float],
    duration: float,
    hop_size: int,
    sample_rate: int,
    window_beats: float = 1.0,
) -> Any:
    import numpy as np  # type: ignore

    frames = np.asarray(hpcp, dtype="float64")
    if frames.ndim != 2 or frames.shape[0] == 0:
        return np.zeros((max(0, len(beats)), 12), dtype="float64")
    times = np.arange(frames.shape[0]) * hop_size / sample_rate
    rows = []
    for index, start in enumerate(beats):
        end = beats[index + 1] if index + 1 < len(beats) else duration
        center = (start + end) / 2
        span = max(1e-3, end - start) * max(1.0, window_beats)
        low = center - span / 2
        high = center + span / 2
        mask = (times >= low - 1e-6) & (times < high + 1e-6)
        if np.any(mask):
            vector = frames[mask].mean(axis=0)
        else:
            nearest = int(np.clip(round(start * sample_rate / hop_size), 0, frames.shape[0] - 1))
            vector = frames[nearest]
        rows.append(_normalize(vector))
    return np.asarray(rows, dtype="float64")


def decode_chords(
    hpcp: Any,
    beats: list[float],
    duration: float,
    hop_size: int,
    sample_rate: int,
    key: tuple[int, str] | None = None,
    bass_chroma_input: Any = None,
) -> list[dict[str, Any]]:
    """Devuelve un acorde por pulso usando croma NNLS + prior tonal + Viterbi."""
    import numpy as np  # type: ignore

    if len(beats) < 2:
        return []

    # NNLSChroma ordena las clases desde La; las plantillas usan Do = 0.
    frames = np.roll(np.asarray(hpcp, dtype="float64"), -3, axis=1)
    bass_frames = (
        np.roll(np.asarray(bass_chroma_input, dtype="float64"), -3, axis=1)
        if bass_chroma_input is not None
        else None
    )
    chroma = _beat_chroma(
        frames, beats, duration, hop_size, sample_rate, CHROMA_WINDOW_BEATS
    )
    bass_chroma = (
        _beat_chroma(
            bass_frames, beats, duration, hop_size, sample_rate, CHROMA_WINDOW_BEATS
        )
        if bass_frames is not None
        else None
    )
    names, templates = _templates()
    raw_emissions = np.clip(chroma @ templates.T, 0.0, 1.0)
    top_states = np.argmax(raw_emissions, axis=1) if len(raw_emissions) else np.array([], dtype="int32")
    key_tonic, key_mode = (
        key
        if key is not None
        else estimate_key(
            np.mean(frames, axis=0) if len(frames) else np.zeros(12),
            top_states,
            names,
        )
    )
    emissions = raw_emissions

    # El bajo suele sostener la fundamental; su croma desempata la raíz.
    if bass_chroma is not None:
        roots = np.arange(len(names)) % 12
        emissions = emissions + 0.3 * bass_chroma[:, roots]

    diatonic = _diatonic_states(names, key_tonic, key_mode)
    for state in diatonic:
        emissions[:, state] += 0.25
    tonic_indexes = {
        index
        for index, name in enumerate(names)
        if name in (PITCH_NAMES[key_tonic], f"{PITCH_NAMES[key_tonic]}m")
    }
    for state in tonic_indexes:
        emissions[:, state] += 0.04

    state_count = len(names)
    transitions = np.full((state_count, state_count), -0.03, dtype="float64")
    np.fill_diagonal(transitions, 0.12)
    for previous in diatonic:
        for following in diatonic:
            if previous != following:
                transitions[previous, following] = 0.0

    frames = emissions.shape[0]
    scores = np.empty((frames, state_count), dtype="float64")
    pointers = np.zeros((frames, state_count), dtype="int32")
    scores[0] = emissions[0]
    for index in range(1, frames):
        candidates = scores[index - 1][:, None] + transitions
        pointers[index] = np.argmax(candidates, axis=0)
        scores[index] = emissions[index] + candidates[pointers[index], np.arange(state_count)]

    labels = np.zeros(frames, dtype="int32")
    labels[-1] = int(np.argmax(scores[-1]))
    for index in range(frames - 1, 0, -1):
        labels[index - 1] = pointers[index, labels[index]]

    segments: list[dict[str, Any]] = []
    for index, state in enumerate(labels):
        start = beats[index]
        end = beats[index + 1] if index + 1 < len(beats) else duration
        if end <= start:
            continue
        raw = raw_emissions[index]
        best = float(raw[state])
        second = float(np.max(np.delete(raw, state))) if len(raw) > 1 else best
        confidence = float(np.clip(0.5 + (best - second), 0.0, 1.0))
        segments.append(
            {
                "start": round(start, 3),
                "end": round(min(duration, end), 3),
                "label": names[state],
                "confidence": round(confidence, 3),
            }
        )
    return segments
