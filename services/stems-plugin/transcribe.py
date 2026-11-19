#!/usr/bin/env python3
"""Reference transcription for the Chordifree stems plugin.

Usage: transcribe.py {bass|drums} <stem.wav> <stem.notes.json>

Notes are monophonic for the bass (librosa pyin) and classified by spectral
band for the drums. Both are approximations meant to replace the generic MIDI
backing, not a full transcription.
"""

from __future__ import annotations

import json
import sys

import librosa
import numpy as np

MIN_NOTE_SECONDS = 0.07
DRUM_LENGTH = 0.1


def flush(notes: list[dict], current: dict | None) -> None:
    if current and current["end"] - current["start"] >= MIN_NOTE_SECONDS:
        notes.append(current)


def bass_notes(path: str) -> list[dict]:
    audio, sample_rate = librosa.load(path, sr=22050, mono=True)
    if audio.size == 0:
        return []
    f0, voiced, _ = librosa.pyin(
        audio,
        fmin=librosa.note_to_hz("E1"),
        fmax=librosa.note_to_hz("G4"),
        sr=sample_rate,
        frame_length=2048,
    )
    times = librosa.times_like(f0, sr=sample_rate)
    notes: list[dict] = []
    current: dict | None = None
    for time, frequency, is_voiced in zip(times, f0, voiced):
        if bool(is_voiced) and np.isfinite(frequency):
            pitch = int(round(librosa.hz_to_midi(float(frequency))))
            if current and pitch == current["pitch"] and time - current["end"] <= 0.08:
                current["end"] = float(time)
            else:
                flush(notes, current)
                current = {
                    "start": float(time),
                    "end": float(time),
                    "pitch": max(0, min(127, pitch)),
                    "velocity": 92,
                }
        else:
            flush(notes, current)
            current = None
    flush(notes, current)
    return notes


def drum_notes(path: str) -> list[dict]:
    audio, sample_rate = librosa.load(path, sr=22050, mono=True)
    if audio.size == 0:
        return []
    onset_frames = librosa.onset.onset_detect(y=audio, sr=sample_rate, backtrack=True)
    if len(onset_frames) == 0:
        return []
    times = librosa.frames_to_time(onset_frames, sr=sample_rate)
    spectrum = np.abs(librosa.stft(audio, n_fft=1024))
    frequencies = librosa.fft_frequencies(sr=sample_rate, n_fft=1024)
    low = frequencies < 150
    mid = (frequencies >= 150) & (frequencies < 2000)
    high = frequencies >= 4000
    hop = 1024 / 2
    notes: list[dict] = []
    for time in times:
        frame = int(round(float(time) * sample_rate / hop))
        frame = max(0, min(spectrum.shape[1] - 1, frame))
        energy_low = float(spectrum[low, frame].sum())
        energy_mid = float(spectrum[mid, frame].sum())
        energy_high = float(spectrum[high, frame].sum())
        if energy_low >= energy_mid and energy_low >= energy_high:
            pitch = 36  # kick
        elif energy_high >= energy_mid:
            pitch = 42  # closed hi-hat
        else:
            pitch = 38  # snare
        notes.append(
            {
                "start": float(time),
                "end": float(time) + DRUM_LENGTH,
                "pitch": pitch,
                "velocity": 96,
            }
        )
    return notes


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: transcribe.py {bass|drums} input.wav output.json", file=sys.stderr)
        return 2
    stem, input_path, output_path = sys.argv[1:4]
    if stem == "bass":
        notes = bass_notes(input_path)
    elif stem == "drums":
        notes = drum_notes(input_path)
    else:
        print(f"unsupported stem: {stem}", file=sys.stderr)
        return 2
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump({"notes": notes}, handle)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
