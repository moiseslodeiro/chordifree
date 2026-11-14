from __future__ import annotations

from pathlib import Path

import pytest

from app import analysis
from app.analysis import analyze_file
from app.vocals import regions_from_probabilities


def test_analyze_returns_segments_covering_the_audio(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    assert result["analyzerVersion"]
    assert result["duration"] == pytest.approx(6.0, abs=0.25)
    segments = result["segments"]
    assert segments, "The analyzer must return at least one segment"

    previous_end = 0.0
    for segment in segments:
        assert 0.0 <= segment["start"] < segment["end"] <= result["duration"] + 0.01
        assert segment["start"] >= previous_end - 0.01
        assert 0.0 <= segment["confidence"] <= 1.0
        previous_end = segment["end"]

    assert previous_end == pytest.approx(result["duration"], abs=0.25)


def test_analyze_returns_beats_and_time_signature(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    assert result["beatsPerBar"] == 4
    assert isinstance(result["beats"], list)
    assert all(isinstance(beat, (int, float)) for beat in result["beats"])
    assert result["beats"] == sorted(result["beats"])
    assert len(result["beats"]) == len(set(result["beats"]))
    assert all(0.0 <= beat <= result["duration"] for beat in result["beats"])


def test_analyze_beats_cover_the_duration(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    if len(result["beats"]) >= 2:
        assert result["beats"][-1] > result["duration"] * 0.6


def _click_track(meter: int, bars: int = 16, bpm: float = 120.0):
    import numpy as np

    rate = analysis.SAMPLE_RATE
    beat = 60.0 / bpm
    total = int(bars * meter * beat * rate)
    audio = np.zeros(total, dtype="float32")
    rng = np.random.default_rng(7)
    for index in range(bars * meter):
        start = int(index * beat * rate)
        amplitude = 1.0 if index % meter == 0 else 0.35
        length = int(0.12 * rate)
        burst = (
            rng.standard_normal(length) * 0.25
            + np.sin(2 * np.pi * 90 * np.arange(length) / rate) * 0.6
        ) * amplitude
        burst *= np.exp(-np.arange(length) / (0.03 * rate))
        end = min(total, start + length)
        audio[start:end] += burst[: end - start]
    beats = [index * beat for index in range(bars * meter)]
    return audio, beats


def test_estimate_beats_per_bar_detects_a_waltz() -> None:
    essentia = analysis._load_essentia()
    audio, beats = _click_track(3)

    assert analysis._estimate_beats_per_bar(essentia, audio, beats) == 3


def test_estimate_beats_per_bar_keeps_four() -> None:
    essentia = analysis._load_essentia()
    audio, beats = _click_track(4)

    assert analysis._estimate_beats_per_bar(essentia, audio, beats) == 4


def test_estimate_beats_per_bar_needs_enough_beats() -> None:
    essentia = analysis._load_essentia()

    assert analysis._estimate_beats_per_bar(essentia, object(), [0.5, 1.0, 1.5]) == 4


def test_extract_beats_sanitizes_invalid_values() -> None:
    class FakeRhythm:
        def __call__(self, _audio: object):
            return 120.0, [1.0, 0.5, 0.5, 2.0, -1.0, float("nan"), 9.0], None, None, None

    essentia = {
        "Resample": lambda **_kwargs: (lambda audio: audio),
        "RhythmExtractor2013": lambda method: FakeRhythm(),
    }

    assert analysis._extract_beats(essentia, object(), 3.0) == [0.5, 1.0, 2.0]


def test_extract_beats_resamples_to_44100_before_rhythm() -> None:
    captured: dict[str, object] = {}

    class FakeResample:
        def __init__(self, **kwargs: object) -> None:
            captured.update(kwargs)

        def __call__(self, audio: object) -> object:
            captured["audio"] = audio
            return audio

    class FakeRhythm:
        def __call__(self, _audio: object):
            return 120.0, [0.5], None, None, None

    essentia = {
        "Resample": FakeResample,
        "RhythmExtractor2013": lambda method: FakeRhythm(),
    }

    assert analysis._extract_beats(essentia, "audio", 10.0) == [0.5]
    assert captured["inputSampleRate"] == analysis.SAMPLE_RATE
    assert captured["outputSampleRate"] == 44100


def test_extract_beats_returns_empty_when_rhythm_fails() -> None:
    def broken(_method: str):
        raise RuntimeError("no rhythm")

    essentia = {
        "Resample": lambda **_kwargs: (lambda audio: audio),
        "RhythmExtractor2013": broken,
    }

    assert analysis._extract_beats(essentia, object(), 3.0) == []


def test_fallback_keeps_the_beats(monkeypatch: pytest.MonkeyPatch, chord_wav: Path) -> None:
    monkeypatch.setattr(analysis, "_extract_beats", lambda *_args: [0.5, 1.5])
    monkeypatch.setattr(
        analysis,
        "_detect_with_beats",
        lambda *_args: (_ for _ in ()).throw(ValueError("no segments")),
    )
    monkeypatch.setattr(analysis, "_detect_fixed_frame", lambda *_args: [])

    result = analysis.analyze_file(str(chord_wav))

    assert result["beats"] == [0.5, 1.5]
    assert result["beatsPerBar"] == 4


def test_analyze_labels_known_chords(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))
    labels = {segment["label"] for segment in result["segments"] if segment["label"]}
    assert labels, "It must detect at least one label"
    assert {"C", "F", "G"} <= labels


def test_analyze_detects_f_g_am_progression(fga_wav: Path) -> None:
    result = analyze_file(str(fga_wav))
    labels = [segment["label"] for segment in result["segments"]]
    assert "F" in labels
    assert "G" in labels
    assert "Am" in labels


def test_analyze_accepts_stereo_audio(stereo_wav: Path) -> None:
    result = analyze_file(str(stereo_wav))
    assert result["duration"] > 0
    assert result["segments"]


def test_apply_silence_marks_sections_without_energy() -> None:
    import numpy as np

    rate = 100
    tones = 0.2 * np.sin(2 * np.pi * 440 * np.arange(rate) / rate)
    audio = np.concatenate([np.zeros(rate), tones]).astype("float32")
    segments = [
        {"start": 0.0, "end": 1.0, "label": "C", "confidence": 0.9},
        {"start": 1.0, "end": 2.0, "label": "C", "confidence": 0.9},
    ]

    result = analysis._apply_silence(segments, audio, rate)

    assert result[0]["label"] is None
    assert result[0]["confidence"] == 0.0
    assert result[1]["label"] == "C"


def test_smooth_chords_removes_an_isolated_flicker() -> None:
    segments = [
        {"start": 0, "end": 1, "label": "C", "confidence": 0.9},
        {"start": 1, "end": 2, "label": "A", "confidence": 0.3},
        {"start": 2, "end": 3, "label": "C", "confidence": 0.9},
    ]

    result = analysis._smooth_chords(segments)

    assert [segment["label"] for segment in result] == ["C", "C", "C"]


def test_smooth_chords_keeps_real_changes() -> None:
    segments = [
        {"start": 0, "end": 1, "label": "C", "confidence": 0.9},
        {"start": 1, "end": 2, "label": "A", "confidence": 0.9},
        {"start": 2, "end": 3, "label": "G", "confidence": 0.9},
    ]

    result = analysis._smooth_chords(segments)

    assert [segment["label"] for segment in result] == ["C", "A", "G"]


def test_detects_vocal_regions_and_discards_short_flickers() -> None:
    import numpy as np

    probabilities = np.zeros(20, dtype="float64")
    probabilities[2:6] = 1.0  # 1.9 s: short flicker, discarded
    probabilities[10:20] = 1.0  # 4.8 s: valid vocal region

    regions = regions_from_probabilities(
        probabilities, hop=0.48, smooth_frames=1, close_gap_frames=3, duration=10.0
    )

    assert regions == [{"start": 4.8, "end": 9.6}]


def test_closes_short_gaps_between_vocal_regions() -> None:
    import numpy as np

    probabilities = np.zeros(20, dtype="float64")
    probabilities[4:8] = 1.0
    probabilities[10:16] = 1.0  # 2-frame gap (0.96 s)

    regions = regions_from_probabilities(
        probabilities, hop=0.48, smooth_frames=1, duration=10.0
    )

    assert regions == [{"start": 1.92, "end": 7.68}]
