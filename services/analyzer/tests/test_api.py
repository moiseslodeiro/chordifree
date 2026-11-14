from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["analyzerVersion"]


def test_rejects_unsupported_extension() -> None:
    response = client.post(
        "/analyze",
        files={"file": ("notes.txt", b"not audio", "text/plain")},
    )
    assert response.status_code == 422


def test_rejects_empty_file() -> None:
    response = client.post(
        "/analyze",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 422


def test_analyzes_valid_wav(chord_wav: Path) -> None:
    with chord_wav.open("rb") as handle:
        response = client.post(
            "/analyze",
            files={"file": (chord_wav.name, handle.read(), "audio/wav")},
        )
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"segments", "duration", "analyzerVersion"}
    assert body["segments"]


def test_local_token(monkeypatch, chord_wav: Path) -> None:
    monkeypatch.setattr("app.main.ANALYZER_TOKEN", "secret-token")

    with chord_wav.open("rb") as handle:
        payload = handle.read()

    rejected = client.post(
        "/analyze",
        files={"file": (chord_wav.name, payload, "audio/wav")},
    )
    assert rejected.status_code == 401

    accepted = client.post(
        "/analyze",
        headers={"X-Chordifree-Token": "secret-token"},
        files={"file": (chord_wav.name, payload, "audio/wav")},
    )
    assert accepted.status_code == 200
