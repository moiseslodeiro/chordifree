from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

import pytest

SAMPLE_RATE = 22050

TRIADS = {
    "C": (261.63, 329.63, 392.0),
    "F": (349.23, 440.0, 523.25),
    "G": (392.0, 493.88, 587.33),
    "Am": (220.0, 261.63, 329.63),
}


def write_triad_sequence(path: Path, sequence: list[str], seconds: float = 2.0) -> None:
    frames = bytearray()
    for name in sequence:
        frequencies = TRIADS[name]
        total = int(seconds * SAMPLE_RATE)
        for index in range(total):
            t = index / SAMPLE_RATE
            fade = min(1.0, t / 0.02, (seconds - t) / 0.02)
            sample = sum(math.sin(2 * math.pi * freq * t) for freq in frequencies)
            sample = (sample / len(frequencies)) * 0.5 * max(0.0, fade)
            frames += struct.pack("<h", int(sample * 32767))

    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SAMPLE_RATE)
        handle.writeframes(bytes(frames))


@pytest.fixture(scope="session")
def chord_wav(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("audio") / "progresion.wav"
    write_triad_sequence(path, ["C", "F", "G"], seconds=2.0)
    return path


@pytest.fixture(scope="session")
def stereo_wav(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("audio") / "estereo.wav"
    mono = tmp_path_factory.mktemp("audio") / "mono.wav"
    write_triad_sequence(mono, ["C"], seconds=1.0)
    with wave.open(str(mono), "rb") as source:
        payload = source.readframes(source.getnframes())
    with wave.open(str(path), "wb") as target:
        target.setnchannels(2)
        target.setsampwidth(2)
        target.setframerate(SAMPLE_RATE)
        stereo = bytearray()
        for index in range(0, len(payload), 2):
            chunk = payload[index : index + 2]
            stereo += chunk + chunk
        target.writeframes(bytes(stereo))
    return path


@pytest.fixture(scope="session")
def fga_wav(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("audio") / "fga.wav"
    write_triad_sequence(path, ["F", "G", "Am", "G", "F", "G", "Am", "G"], seconds=1.0)
    return path
