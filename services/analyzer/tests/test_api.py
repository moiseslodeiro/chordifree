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


def test_rechaza_extension_no_admitida() -> None:
    response = client.post(
        "/analyze",
        files={"file": ("notas.txt", b"no soy audio", "text/plain")},
    )
    assert response.status_code == 422


def test_rechaza_archivo_vacio() -> None:
    response = client.post(
        "/analyze",
        files={"file": ("vacio.wav", b"", "audio/wav")},
    )
    assert response.status_code == 422


def test_analiza_wav_valido(chord_wav: Path) -> None:
    with chord_wav.open("rb") as handle:
        response = client.post(
            "/analyze",
            files={"file": (chord_wav.name, handle.read(), "audio/wav")},
        )
    assert response.status_code == 200
    body = response.json()
    assert set(body) >= {"segments", "duration", "analyzerVersion"}
    assert body["segments"]
