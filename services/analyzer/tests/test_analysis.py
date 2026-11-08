from __future__ import annotations

from pathlib import Path

import pytest

from app import analysis
from app.analysis import analyze_file


def test_analyze_devuelve_segmentos_que_cubren_el_audio(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    assert result["analyzerVersion"]
    assert result["duration"] == pytest.approx(6.0, abs=0.25)
    segments = result["segments"]
    assert segments, "El analizador debe devolver al menos un segmento"

    previous_end = 0.0
    for segment in segments:
        assert 0.0 <= segment["start"] < segment["end"] <= result["duration"] + 0.01
        assert segment["start"] >= previous_end - 0.01
        assert 0.0 <= segment["confidence"] <= 1.0
        previous_end = segment["end"]

    assert previous_end == pytest.approx(result["duration"], abs=0.25)


def test_analyze_devuelve_pulsos_y_compas(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    assert result["beatsPerBar"] == 4
    assert isinstance(result["beats"], list)
    assert all(isinstance(beat, (int, float)) for beat in result["beats"])
    assert result["beats"] == sorted(result["beats"])
    assert len(result["beats"]) == len(set(result["beats"]))
    assert all(0.0 <= beat <= result["duration"] for beat in result["beats"])


def test_analyze_pulsos_cubren_la_duracion(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))

    if len(result["beats"]) >= 2:
        assert result["beats"][-1] > result["duration"] * 0.6


def test_extract_beats_sanea_valores_invalidos() -> None:
    class FakeRhythm:
        def __call__(self, _audio: object):
            return 120.0, [1.0, 0.5, 0.5, 2.0, -1.0, float("nan"), 9.0], None, None, None

    essentia = {
        "Resample": lambda **_kwargs: (lambda audio: audio),
        "RhythmExtractor2013": lambda method: FakeRhythm(),
    }

    assert analysis._extract_beats(essentia, object(), 3.0) == [0.5, 1.0, 2.0]


def test_extract_beats_remuestrea_a_44100_antes_del_ritmo() -> None:
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


def test_extract_beats_devuelve_vacio_si_falla_el_ritmo() -> None:
    def broken(_method: str):
        raise RuntimeError("sin ritmo")

    essentia = {
        "Resample": lambda **_kwargs: (lambda audio: audio),
        "RhythmExtractor2013": broken,
    }

    assert analysis._extract_beats(essentia, object(), 3.0) == []


def test_fallback_conserva_los_pulsos(monkeypatch: pytest.MonkeyPatch, chord_wav: Path) -> None:
    monkeypatch.setattr(analysis, "_extract_beats", lambda *_args: [0.5, 1.5])
    monkeypatch.setattr(
        analysis,
        "_detect_with_beats",
        lambda *_args: (_ for _ in ()).throw(ValueError("sin segmentos")),
    )
    monkeypatch.setattr(analysis, "_detect_fixed_frame", lambda *_args: [])

    result = analysis.analyze_file(str(chord_wav))

    assert result["beats"] == [0.5, 1.5]
    assert result["beatsPerBar"] == 4


def test_analyze_etiqueta_acordes_conocidos(chord_wav: Path) -> None:
    result = analyze_file(str(chord_wav))
    labels = {segment["label"] for segment in result["segments"] if segment["label"]}
    assert labels, "Debe detectar al menos una etiqueta"
    assert any(label[0] in "ABCDEFG" for label in labels)


def test_analyze_acepta_audio_estereo(stereo_wav: Path) -> None:
    result = analyze_file(str(stereo_wav))
    assert result["duration"] > 0
    assert result["segments"]
